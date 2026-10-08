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
  it('highlights repeated qualification evidence without counting duplicate criteria', async () => {
    const { app, input, repository } = await setup(
      'Requirements\nTypeScript required.\nExperience with TypeScript required.\nCompensation\nTypeScript training allowance.',
    );

    const job = (await repository.read()).jobs[0]!;

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/jobs/${job.id}/resume-match`,
      payload: { profile: input.profile },
    });

    const result = response.json();
    const mentions = result.skills.filter((item: { id: string }) => item.id === 'typescript');

    expect(response.statusCode).toBe(200);
    expect(mentions).toHaveLength(2);
    expect(result.requirements.skills).toHaveLength(1);
    expect(result.comparison.assessmentCoverage.total).toBe(1);

    for (const mention of mentions) {
      expect(
        result.descriptionText.slice(mention.position, mention.position + mention.length),
      ).toBe('TypeScript');

      expect(mention.confidence).toBe('green');
    }
  });

  it('uses the job exposure interpretation consistently in comparisons and keyword colors', async () => {
    const { app, input, repository } = await setup(
      'Your Expertise\nSome exposure to writing automated tests or working with a testing framework (e.g., Playwright, Cypress, Espresso, XCUITest).',
    );

    const job = (await repository.read()).jobs[0]!;

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/jobs/${job.id}/resume-match`,
      payload: {
        profile: { ...input.profile, skills: [{ id: 'espresso', status: 'user_confirmed' }] },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().comparison.skills[0]).toMatchObject({ credit: 1, confidence: 'green' });

    expect(
      response.json().skills.find((item: { id: string }) => item.id === 'espresso'),
    ).toMatchObject({ credit: 1, confidence: 'green', interpretation: 'explicit' });
  });

  it('returns the same criterion coverage in recommendations and single-job comparison', async () => {
    const { app, input } = await setup(
      'Requirements\nTypeScript required.\nKnowledge of UncataloguedHDL required.',
    );

    const matched = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-matches',
      payload: input,
    });

    expect(matched.statusCode).toBe(200);

    const item = matched.json().items[0];

    expect(item.assessmentCoverage).toEqual({
      assessed: 1,
      total: 2,
      percentage: 50,
      limited: false,
    });

    expect(item).not.toHaveProperty('completeness');
    expect(item.fitScore).toBeNull();

    const compared = await app.inject({
      method: 'POST',
      url: `/api/v1/jobs/${item.job.id}/resume-match`,
      payload: { profile: input.profile },
    });

    expect(compared.statusCode).toBe(200);
    expect(compared.json().comparison.assessmentCoverage).toEqual(item.assessmentCoverage);
    expect(compared.json().comparison.fitScore).toBeNull();
  });

  it('compares degree and duration annotations, includes responsibility skills and keeps candidate metadata transient', async () => {
    const { app, repository, input } = await setup(
      'Requirements\nBS (or higher) in Computer Science, or a related field\n7+ years of production level experience in one of: Java, Scala, C++, or similar language.\nThe impact you’ll have\nBuild Scala and Kubernetes services.',
    );

    const before = await repository.read();
    const job = before.jobs[0]!;

    const profile = {
      ...input.profile,
      skills: [
        { id: 'java', status: 'user_confirmed' },
        { id: 'scala', status: 'user_confirmed' },
      ],
      education: [{ level: 'master', field: 'computer-science', completion: 'completed' }],
      skillTenure: [{ skillId: 'java', months: 96 }],
    };

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/jobs/${job.id}/resume-match`,
      payload: { profile },
    });

    expect(response.statusCode).toBe(200);

    const result = response.json();

    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'education', confidence: 'green' }),
        expect.objectContaining({ rule: 'experience', confidence: 'green' }),
      ]),
    );

    expect(
      result.skills.some((skill: { rule: string }) => skill.rule.startsWith('role-context:')),
    ).toBe(true);

    for (const metric of result.metrics) {
      expect(
        result.descriptionText.slice(metric.position, metric.position + metric.length),
      ).toMatch(/BS|7\+ years/);
    }

    expect(response.headers['cache-control']).toBe('no-store');
    expect(await repository.read()).toEqual(before);

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/resume-matches',
          payload: {
            ...input,
            profile: {
              ...profile,
              education: [{ ...profile.education[0], institution: 'private school' }],
            },
          },
        })
      ).statusCode,
    ).toBe(400);
  });

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

  it('round trips structured evidence, rejects forged/private fields and invalidates evidence edits', async () => {
    const { app, repository, input } = await setup();
    const before = await repository.read();

    const analyzed = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-analysis',
      payload: {
        text: 'Synthetic Candidate\nExperience\nSoftware Engineer | Fictional Labs\nJan 2020 - Dec 2023\nBuilt TypeScript services.\nSkills\nKotlin',
        analysisDate: '2026-10-01',
      },
    });

    expect(analyzed.statusCode).toBe(200);

    const analysis = analyzed.json();

    expect(
      analysis.document.blocks.some((block: { lineIds: string[] }) =>
        block.lineIds.includes('line-5'),
      ),
    ).toBe(true);

    const profile = {
      ...input.profile,
      skills: analysis.skills.map(
        ({
          id,
          status,
          facets,
          deniedFacets,
          uncertainFacets,
          interpretation,
          evidenceRefs,
        }: {
          id: string;
          status: string;
          facets: string[];
          deniedFacets: string[];
          uncertainFacets: string[];
          interpretation: string;
          evidenceRefs: unknown[];
        }) => ({ id, status, facets, deniedFacets, uncertainFacets, interpretation, evidenceRefs }),
      ),
      employment: analysis.employment.map(
        ({
          id,
          employer,
          category,
          kind,
          relationship,
          start,
          end,
        }: {
          id: string;
          employer: string;
          category: string;
          kind: string;
          relationship: string;
          start: string;
          end: string;
        }) => ({ id, employer, category, kind, relationship, start, end }),
      ),
    };

    const request = (value: unknown) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/resume-matches',
        payload: { ...input, profile: value },
      });

    const matched = await request(profile);

    expect(matched.statusCode).toBe(200);

    expect(matched.json().items[0].skills[0].evidenceRefs[0]).toMatchObject({
      source: 'employment',
      assertion: 'performed',
      action: 'build',
      objectId: 'typescript',
      roleId: analysis.employment[0].id,
    });

    expect(matched.body).not.toContain('Built TypeScript services');

    const first = profile.skills[0];

    for (const extra of [
      { objectId: 'java' },
      { roleId: 'employment-999' },
      { excerpt: 'PRIVATE_STRUCTURED_SENTINEL' },
      { lineIds: Array.from({ length: 21 }, (_, index) => `line-${index}`) },
    ]) {
      const invalid = await request({
        ...profile,
        skills: [{ ...first, evidenceRefs: [{ ...first.evidenceRefs[0], ...extra }] }],
      });

      expect(invalid.statusCode).toBe(400);
      expect(invalid.body).not.toContain('PRIVATE_STRUCTURED_SENTINEL');
    }

    const changed = await app.inject({
      method: 'POST',
      url: '/api/v1/resume-matches',
      payload: {
        ...input,
        profile: {
          ...profile,
          skills: [
            { ...first, evidenceRefs: [{ ...first.evidenceRefs[0], assertion: 'assisted' }] },
          ],
        },
        cursor: matched.json().nextCursor,
      },
    });

    expect(changed.statusCode).toBe(409);
    expect(await repository.read()).toEqual(before);

    const compared = await app.inject({
      method: 'POST',
      url: `/api/v1/jobs/${before.jobs[0]!.id}/resume-match`,
      payload: { profile },
    });

    expect(compared.statusCode).toBe(200);

    expect(compared.json()).toMatchObject({
      document: { version: 'job-document-3' },
      requirements: {
        clauses: expect.arrayContaining([expect.objectContaining({ modality: 'obligation' })]),
      },
      comparison: { band: 'strong', unresolvedRequirements: 0, fitScore: 100 },
    });
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
