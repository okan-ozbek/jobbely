import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from './app.js';
import { Accounts } from '../application/accounts/accounts.js';
import { ReviewResume } from '../application/resume/review-resume.js';
import { MemoryAccounts } from '../infrastructure/storage/accounts-memory.js';
import { MemoryJobRepository } from '../infrastructure/storage/memory.js';
import { JobCatalog } from '../application/catalog.js';
import { freeAccess } from '../domain/accounts/access.js';
import type { ResumeWritingReviewer } from '../ports/resume-review.js';

const apps: FastifyInstance[] = [];
const origin = 'http://127.0.0.1:5173';

const payload = {
  text: 'Synthetic Candidate\nExperience\n2024 - 2020\n- Built reports.',
  aiConsent: false,
  language: 'en-GB',
  targetCountry: '',
  jobDescription: '',
};

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup(paid = false, writer?: ResumeWritingReviewer, proPreview = false) {
  const repository = new MemoryJobRepository();

  const accounts = new Accounts(
    new MemoryAccounts(),
    [
      {
        name: 'github',
        authorizationUrl: ({ state }) => `https://github.com/login/oauth/authorize?state=${state}`,
        verify: async () => ({
          provider: 'github',
          issuer: 'https://github.com',
          subject: 'review-test',
          email: 'synthetic@example.invalid',
        }),
      },
    ],
    undefined,
    proPreview ? new Date(Date.now() + 86_400_000).toISOString() : null,
  );

  const start = await accounts.start('github');
  const state = new URL(start.authorizationUrl).searchParams.get('state')!;
  const signedIn = await accounts.finish('github', state, 'synthetic-code', start.browser);

  const entitlement = {
    ...freeAccess(signedIn.session.user.id),
    planRevisionId: 'synthetic-paid-revision',
    capabilities: ['resume_review'] as const,
    accessEndsAt: new Date(Date.now() + 3_600_000).toISOString(),
  };

  const resolver = vi.spyOn(accounts, 'resolve').mockImplementation(async (subject) => {
    const session = await accounts.current(subject.binding);

    return paid ? entitlement : freeAccess(session!.user.id);
  });

  const reviewer = new ReviewResume(writer);

  const app = await createApp({
    repository,
    catalog: new JobCatalog(repository, [], [], 'demo'),
    accounts,
    resumeReviewer: reviewer,
    origin,
  });

  apps.push(app);

  return {
    app,
    accounts,
    resolver,
    entitlement,
    repository,
    headers: {
      origin,
      cookie: `jobbely_session=${signedIn.token}`,
      'x-csrf-token': signedIn.session.csrfToken,
    },
  };
}

describe('paid private resume reviewer', () => {
  it('unlocks the account and reviewer through the actual temporary Pro resolver', async () => {
    const { app, headers, resolver } = await setup(false, undefined, true);

    resolver.mockRestore();

    const account = await app.inject({ url: '/api/v1/account', headers });

    expect(account.json().access).toMatchObject({
      planRevisionId: 'local-pro-preview',
      capabilities: expect.arrayContaining(['resume_review']),
    });

    expect((await app.inject({ url: '/api/v1/resume-review', headers })).json().enabled).toBe(true);

    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/resume-review', headers, payload }))
        .statusCode,
    ).toBe(200);
  });

  it('exposes availability without accepting or sending a resume', async () => {
    const { app, headers } = await setup();

    expect((await app.inject('/api/v1/resume-review')).json()).toEqual({
      signedIn: false,
      enabled: false,
      aiAvailable: false,
    });

    const response = await app.inject({ url: '/api/v1/resume-review', headers });

    expect(response.json()).toEqual({ signedIn: true, enabled: false, aiAvailable: false });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('blocks guest and Free accounts before a model call', async () => {
    const review = vi.fn(async () => []);
    const { app, headers } = await setup(false, { review });

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/resume-review',
          headers: { origin },
          payload: { ...payload, aiConsent: true },
        })
      ).statusCode,
    ).toBe(401);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-review',
      headers,
      payload: { ...payload, aiConsent: true },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('upgrade_required');
    expect(review).not.toHaveBeenCalled();
  });

  it('requires exact Origin, session CSRF and strict server-owned access', async () => {
    const { app, headers } = await setup(true);

    const cases = [
      { headers: { ...headers, origin: 'https://other.invalid' }, payload, status: 403 },
      {
        headers: { cookie: headers.cookie, 'x-csrf-token': headers['x-csrf-token'] },
        payload,
        status: 403,
      },
      { headers: { ...headers, 'x-csrf-token': 'forged' }, payload, status: 401 },
      { headers, payload: { ...payload, userId: 'forged', paid: true }, status: 400 },
      { headers, payload: { ...payload, text: ' ' }, status: 400 },
      {
        headers,
        payload: {
          ...payload,
          layout: {
            format: 'pdf',
            pages: 1,
            columnPages: [999],
            smallTextPages: [],
            tableRows: 0,
            contactInHeaderFooter: false,
          },
        },
        status: 400,
      },
    ];

    for (const candidate of cases) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/resume-review',
        headers: candidate.headers,
        payload: candidate.payload,
      });

      expect(response.statusCode).toBe(candidate.status);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).not.toContain('Synthetic Candidate');
    }
  });

  it('returns rules and grounded AI findings without changing stored jobs', async () => {
    const review = vi.fn(async () => [
      {
        category: 'impact' as const,
        title: 'Describe the benefit',
        explanation: 'The contribution is unclear.',
        suggestion: 'Describe who used the reports if known.',
        quote: 'Built reports.',
        line: 4,
        rewrite: null,
      },
    ]);

    const { app, headers, repository } = await setup(true, { review });
    const before = await repository.read();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-review',
      headers,
      payload: { ...payload, aiConsent: true },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toMatchObject({
      aiStatus: 'completed',
      findings: expect.arrayContaining([
        expect.objectContaining({ source: 'rule', severity: 'error' }),
        expect.objectContaining({ source: 'ai', line: 4 }),
      ]),
    });

    expect(JSON.stringify(review.mock.calls)).not.toContain('Synthetic Candidate');
    expect(await repository.read()).toEqual(before);
  });

  it('fails closed for expired, wrong-owner, revoked or unavailable access', async () => {
    const { app, headers, resolver, entitlement } = await setup(true);

    for (const access of [
      { ...entitlement, accessEndsAt: new Date(0).toISOString() },
      { ...entitlement, userId: 'other' },
      { ...entitlement, capabilities: [] },
    ]) {
      resolver.mockResolvedValue(access);

      expect(
        (await app.inject({ method: 'POST', url: '/api/v1/resume-review', headers, payload }))
          .statusCode,
      ).toBe(403);
    }

    resolver.mockRejectedValue(new Error('private repository detail'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-review',
      headers,
      payload,
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('private repository detail');
  });

  it('rechecks access after model work before delivering private findings', async () => {
    const { app, headers, resolver, entitlement } = await setup(true, { review: async () => [] });

    resolver
      .mockResolvedValueOnce(entitlement)
      .mockResolvedValueOnce(freeAccess(entitlement.userId));

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/resume-review',
          headers,
          payload: { ...payload, aiConsent: true },
        })
      ).statusCode,
    ).toBe(403);
  });
});
