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
import type { ResumeRoleAssessor } from '../ports/resume-role-assessment.js';
import { seedDemo } from '../infrastructure/demo.js';
import { loadRegistry } from '../infrastructure/registry.js';

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

async function setup(
  paid = false,
  writer?: ResumeWritingReviewer & Partial<ResumeRoleAssessor>,
  proPreview = false,
) {
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

async function roleSetup(paid = true) {
  const assess = vi.fn<ResumeRoleAssessor['assess']>().mockImplementation(async (input) => ({
    evidence: (['ats', 'recruiter'] as const).map((area) => ({
      area,
      status: 'supported',
      jobQuote: input.jobDescription.slice(0, 35),
      resumeQuote: 'Built reports.',
      line: 4,
      explanation: 'The excerpt describes a contribution.',
      suggestion: 'Add factual detail about the contribution.',
    })),
  }));

  const context = await setup(paid, { review: async () => [], assess });

  await seedDemo(context.repository, loadRegistry().sources);

  const job = (await context.repository.read()).jobs[0]!;

  return {
    ...context,
    assess,
    job,
    url: `/api/v1/jobs/${job.id}/resume-assessment`,
    body: { text: payload.text, aiConsent: true },
  };
}

describe('private Pro role assessment', () => {
  it('uses the stored job, verifies both excerpts and keeps outputs private', async () => {
    const { app, headers, url, body, assess, job } = await roleSetup();
    const response = await app.inject({ method: 'POST', url, headers, payload: body });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toMatchObject({
      aiStatus: 'completed',
      ats: { confidence: 'moderate' },
      recruiter: { confidence: 'moderate' },
    });

    expect(response.headers['cache-control']).toBe('no-store');
    expect(assess.mock.calls[0]![0].jobDescription).toContain('Synthetic demonstration listing');
    expect(assess.mock.calls[0]![0].jobTitle).toBe(job.title);

    expect(assess.mock.calls[0]![0].segments.map((item) => item.text).join(' ')).not.toContain(
      'Synthetic Candidate',
    );
  });

  it('requires paid access, Origin, CSRF and explicit consent before calling AI', async () => {
    const free = await roleSetup(false);

    expect(
      (
        await free.app.inject({
          method: 'POST',
          url: free.url,
          headers: free.headers,
          payload: free.body,
        })
      ).statusCode,
    ).toBe(403);

    expect(free.assess).not.toHaveBeenCalled();

    const { app, url, headers, body, assess } = await roleSetup();

    for (const request of [
      { headers: { origin }, payload: body, status: 401 },
      { headers: { ...headers, origin: 'https://example.invalid' }, payload: body, status: 403 },
      { headers: { ...headers, 'x-csrf-token': 'wrong' }, payload: body, status: 401 },
      { headers, payload: { ...body, aiConsent: false }, status: 400 },
      { headers, payload: { ...body, jobDescription: 'Client supplied role' }, status: 400 },
    ]) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url,
            headers: request.headers,
            payload: request.payload,
          })
        ).statusCode,
      ).toBe(request.status);
    }

    expect(assess).not.toHaveBeenCalled();
  });

  it('fails safely for missing jobs and invalid provider evidence', async () => {
    const { app, url, headers, body, assess } = await roleSetup();

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/jobs/nonexistent/resume-assessment',
          headers,
          payload: body,
        })
      ).statusCode,
    ).toBe(404);

    expect(assess).not.toHaveBeenCalled();
    assess.mockResolvedValueOnce({ evidence: [] });

    expect(
      (await app.inject({ method: 'POST', url, headers, payload: body })).json(),
    ).toMatchObject({ aiStatus: 'failed', evidence: [] });
  });

  it('shares hourly admission with writing feedback and rechecks access after work', async () => {
    const { app, url, headers, body, resolver, assess } = await roleSetup();

    for (let index = 0; index < 5; index++) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/resume-review',
            headers,
            payload: { ...payload, aiConsent: true },
          })
        ).statusCode,
      ).toBe(200);
    }

    expect((await app.inject({ method: 'POST', url, headers, payload: body })).statusCode).toBe(
      429,
    );

    expect(assess).not.toHaveBeenCalled();
    resolver.mockRestore();

    const changed = await roleSetup();

    changed.assess.mockImplementationOnce(async () => {
      changed.resolver.mockResolvedValue(freeAccess());

      return { evidence: [] };
    });

    expect(
      (
        await changed.app.inject({
          method: 'POST',
          url: changed.url,
          headers: changed.headers,
          payload: changed.body,
        })
      ).statusCode,
    ).toBe(403);
  });
});

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
      aiProvider: null,
    });

    const response = await app.inject({ url: '/api/v1/resume-review', headers });

    expect(response.json()).toEqual({
      signedIn: true,
      enabled: false,
      aiAvailable: false,
      aiProvider: null,
    });

    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('identifies the provider for informed AI consent without invoking it', async () => {
    const review = vi.fn(async () => []);
    const { app, headers } = await setup(true, { provider: 'codex-local', review });

    expect((await app.inject({ url: '/api/v1/resume-review', headers })).json()).toEqual({
      signedIn: true,
      enabled: true,
      aiAvailable: true,
      aiProvider: 'codex-local',
    });

    expect(review).not.toHaveBeenCalled();
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
