import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from './app.js';
import { JobCatalog } from '../application/catalog.js';
import { AnalyzeResume } from '../application/resume/analyze-resume.js';
import { MatchJobs } from '../application/resume/match-jobs.js';
import { BackfillJobFeatures } from '../application/resume/job-features.js';
import { MemoryJobRepository } from '../infrastructure/storage/memory.js';
import { MemoryJobFeatures } from '../infrastructure/storage/feature-memory.js';
import { candidate, storedJob } from '../test-fixtures/resume-matching.js';
import type { Source } from '../domain/model.js';

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup(description?: string) {
  const repository = new MemoryJobRepository();

  const source: Source = {
    id: 'source',
    companySlug: 'meta',
    provider: 'greenhouse',
    board: 'test',
    auditStatus: 'candidate',
    scheduled: false,
  };

  const run = await repository.startRun(source, '2026-10-01T00:00:00.000Z');

  await repository.commitSnapshot({
    source,
    runId: run!.id,
    observedAt: '2026-10-01T00:00:00.000Z',
    postings: [storedJob('1', description), storedJob('2', description)],
    rawResponses: [],
    excluded: 0,
    enumerationComplete: true,
  });

  const features = new MemoryJobFeatures(() => repository.read());

  await new BackfillJobFeatures(features).execute();

  const app = await createApp({
    repository,
    catalog: new JobCatalog(repository, [], [source], 'postgres'),
    resume: new AnalyzeResume([]),
    matcher: new MatchJobs(
      features,
      [],
      [source],
      'postgres',
      () => new Date('2026-10-01T01:00:00.000Z'),
    ),
  });

  apps.push(app);

  return {
    app,
    repository,
    input: { profile: candidate(), categories: ['engineering'], employerContext: false, limit: 1 },
  };
}

describe('private matching API and public requirements', () => {
  it('compares description keywords privately and updates colors after profile changes', async () => {
    const { app, repository, input } = await setup();
    const before = await repository.read();
    const job = before.jobs[0]!;
    const url = `/api/v1/jobs/${job.id}/resume-match`;

    const request = (profile: typeof input.profile) =>
      app.inject({ method: 'POST', url, payload: { profile } });

    const response = await request(input.profile);

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    expect(response.json()).toMatchObject({
      recommendationEligible: true,
      skills: [{ id: 'typescript', confidence: 'green' }],
    });

    expect(response.json().descriptionText).toBe(job.descriptionText);

    const missing = await request({ ...input.profile, skills: [] });

    expect(missing.json().skills[0].confidence).toBe('red');

    const learning = await request({
      ...input.profile,
      skills: [{ id: 'typescript', status: 'learning' }],
    });

    expect(learning.json().skills[0].confidence).toBe('yellow');
    expect(learning.json().comparison.requiredGaps).toBeGreaterThan(0);
    expect(await repository.read()).toEqual(before);

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/jobs/absent/resume-match',
          payload: { profile: input.profile },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('serializes purple zero-credit suggestions and scoped reviews, without changing storage', async () => {
    const { app, repository, input } = await setup(
      'Requirements\nClang required.\nClang frontend development required.',
    );

    const before = await repository.read();
    const job = before.jobs[0]!;
    const text = 'Experience\nBuilt C++ services.';

    for (const answer of [null, 'confirmed', 'denied', 'unsure'] as const) {
      const analyzed = await app.inject({
        method: 'POST',
        url: '/api/v1/resume-analysis',
        payload: {
          text,
          analysisDate: '2026-10-01',
          ...(answer
            ? { corrections: { signalReviews: [{ id: 'clang', facet: 'usage', answer }] } }
            : {}),
        },
      });

      expect(analyzed.statusCode).toBe(200);

      const profile = { ...input.profile, skills: analyzed.json().skills, competencies: [] };

      // Only structured claims cross the private matching boundary.
      profile.skills = profile.skills.map(
        ({ id, status, facets, deniedFacets, uncertainFacets, interpretation }) => ({
          id,
          status,
          facets,
          deniedFacets,
          uncertainFacets,
          interpretation,
        }),
      );

      const compared = await app.inject({
        method: 'POST',
        url: `/api/v1/jobs/${job.id}/resume-match`,
        payload: { profile },
      });

      expect(compared.statusCode).toBe(200);
      expect(compared.headers['cache-control']).toBe('no-store');

      const usage = compared
        .json()
        .comparison.skills.find(
          (item: { targetId: string; facet: string }) =>
            item.targetId === 'clang' && item.facet === 'usage',
        );

      expect(usage.decision).toBe(
        answer === null
          ? 'suggested'
          : answer === 'confirmed'
            ? 'full'
            : answer === 'denied'
              ? 'none'
              : 'partial',
      );

      expect(usage.credit).toBe(answer === 'confirmed' ? 1 : 0);

      const development = compared
        .json()
        .comparison.skills.find(
          (item: { targetId: string; facet: string }) =>
            item.targetId === 'clang' && item.facet === 'development',
        );

      expect(development.credit).toBeLessThan(1);
      expect(compared.body).not.toContain('Built C++ services');
    }

    expect(await repository.read()).toEqual(before);

    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-matches',
      payload: {
        ...input,
        profile: {
          ...input.profile,
          skills: [{ id: 'java', status: 'user_confirmed', facets: ['development'] }],
        },
      },
    });

    expect(invalid.statusCode).toBe(400);
  });

  it('uses strict private errors, origin and body limits for description comparisons', async () => {
    const { app, repository, input } = await setup();
    const job = (await repository.read()).jobs[0]!;
    const url = `/api/v1/jobs/${job.id}/resume-match`;
    const secret = 'PRIVATE_DESCRIPTION_SENTINEL';

    for (const request of [
      { payload: { profile: { ...input.profile, contact: secret } }, status: 400 },
      {
        payload: { profile: input.profile },
        headers: { origin: 'https://unexpected.invalid' },
        status: 403,
      },
      { payload: { profile: { ...input.profile, analysisDate: '2026-02-30' } }, status: 400 },
      { payload: { text: secret.repeat(20_000) }, status: 413 },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url,
        payload: request.payload,
        ...('headers' in request ? { headers: request.headers } : {}),
      });

      expect(response.statusCode).toBe(request.status);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).not.toContain(secret);
    }
  });

  it('returns explained recommendations and original description requirements without candidate persistence', async () => {
    const { app, repository, input } = await setup();
    const before = await repository.read();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-matches',
      payload: input,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    expect(response.json()).toMatchObject({
      evaluated: 2,
      items: [{ band: 'strong', skills: [{ status: 'matched' }] }],
    });

    const job = before.jobs[0]!;
    const requirements = await app.inject(`/api/v1/jobs/${job.id}/requirements`);

    expect(requirements.statusCode).toBe(200);

    expect(requirements.json()).toMatchObject({
      skills: [{ importance: 'required', alternatives: [{ id: 'typescript' }] }],
    });

    expect(await repository.read()).toEqual(before);
    expect((await app.inject('/api/v1/resume-matches')).statusCode).toBe(404);
  });

  it('rejects raw/private profile fields, malformed JSON and wrong origins without reflecting content', async () => {
    const { app, input } = await setup();
    const secret = 'PRIVATE_CONTACT_SENTINEL';

    for (const payload of [
      { ...input, profile: { ...input.profile, document: secret } },
      { ...input, profile: { ...input.profile, contact: secret } },
      `{"${secret}":`,
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/resume-matches',
        headers: { 'content-type': 'application/json' },
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).not.toContain(secret);
      expect(response.headers['cache-control']).toBe('no-store');
    }

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/resume-matches',
          headers: { origin: 'https://wrong.invalid' },
          payload: input,
        })
      ).statusCode,
    ).toBe(403);
  });

  it('rejects stale profile pagination and unsafe analysis dates', async () => {
    const { app, input } = await setup();

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-matches',
      payload: input,
    });

    const nextCursor = first.json<{ nextCursor: string }>().nextCursor;

    const changed = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-matches',
      payload: { ...input, employerContext: true, cursor: nextCursor },
    });

    expect(changed.statusCode).toBe(409);

    for (const analysisDate of ['2026-02-30', '2099-01-01']) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/resume-matches',
            payload: { ...input, profile: { ...input.profile, analysisDate } },
          })
        ).statusCode,
      ).toBe(400);
    }
  });

  it('bounds matching requests per connection IP and does not trust spoofed forwarded addresses', async () => {
    const { app, input } = await setup();

    for (let index = 0; index < 15; index++) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/resume-matches',
            payload: input,
            headers: { 'x-forwarded-for': `198.51.100.${index}` },
          })
        ).statusCode,
      ).toBe(200);
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-matches',
      payload: input,
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('60');
  });
});
