import { describe, expect, it } from 'vitest';
import { MatchJobs } from './match-jobs.js';
import { BackfillJobFeatures } from './job-features.js';
import { MemoryJobFeatures } from '../../infrastructure/storage/feature-memory.js';
import { candidate, featureJob, storedJob } from '../../test-fixtures/resume-matching.js';
import { compareMatches } from '../../domain/matching/score.js';
import type { Dataset, Source } from '../../domain/model.js';
import type { JobFeatureRepository } from '../../ports/job-features.js';
import type { MatchInput } from '../../domain/matching/model.js';

const source: Source = {
  id: 'source',
  companySlug: 'meta',
  provider: 'greenhouse',
  board: 'test',
  auditStatus: 'candidate',
  scheduled: false,
};

async function setup(mode: 'demo' | 'postgres' = 'postgres') {
  const dataset: Dataset = {
    version: 1,
    jobs: [
      storedJob('1'),
      storedJob('2'),
      storedJob('closed'),
      storedJob('stale'),
      storedJob('missing'),
    ],
    runs: [
      {
        id: 'run',
        sourceId: 'source',
        startedAt: '2026-10-01T00:00:00.000Z',
        finishedAt: '2026-10-01T00:00:00.000Z',
        status: 'succeeded',
        listingCount: 5,
        excludedCount: 0,
        enumerationComplete: true,
        removalsQuarantined: false,
        error: null,
      },
    ],
  };

  dataset.jobs[2]!.status = 'closed';
  dataset.jobs[3]!.lastSeenAt = '2026-09-25T00:00:00.000Z';
  dataset.jobs[4]!.missingSince = '2026-10-01T00:00:00.000Z';

  const features = new MemoryJobFeatures(async () => dataset);
  const backfill = new BackfillJobFeatures(features);

  await backfill.execute();

  const matcher = new MatchJobs(
    features,
    [],
    [source],
    mode,
    () => new Date('2026-10-01T01:00:00.000Z'),
  );

  const input: MatchInput = {
    profile: candidate(),
    categories: ['engineering'],
    employerContext: false,
    limit: 1,
  };

  return { dataset, features, matcher, input, backfill };
}

describe('stateless full matching flow', () => {
  it('allows retained description comparison while clearly excluding stale, closed, missing and demo jobs from recommendations', async () => {
    const { matcher, input, dataset } = await setup();

    const results = await Promise.all(
      dataset.jobs.map((job) => matcher.explain(job, input.profile)),
    );

    expect(results.map((item) => item.recommendationEligible)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);

    expect(results.every((item) => item.skills.length > 0)).toBe(true);

    const demo = await setup('demo');

    expect(
      (await demo.matcher.explain(demo.dataset.jobs[0]!, input.profile)).recommendationEligible,
    ).toBe(false);
  });

  it('excludes closed, missing, stale and demo postings; candidate scope stays visible', async () => {
    const { matcher, input } = await setup();
    const result = await matcher.execute(input);

    expect(result).toMatchObject({ evaluated: 2, eligible: 2, unenriched: 0, freshnessHours: 36 });
    expect(result.items[0]!.coverage).toContain('candidate');
    expect((await (await setup('demo')).matcher.execute(input)).items).toEqual([]);
  });

  it.each(['failed', 'quarantined', 'incomplete', 'stale'])(
    'excludes %s sources',
    async (state) => {
      const { dataset, matcher, input } = await setup();
      const run = dataset.runs[0]!;

      if (state === 'failed') {
        run.status = 'failed';
      }

      if (state === 'quarantined') {
        run.removalsQuarantined = true;
      }

      if (state === 'incomplete') {
        run.enumerationComplete = false;
      }

      if (state === 'stale') {
        run.finishedAt = '2026-09-25T00:00:00.000Z';
      }

      expect((await matcher.execute(input)).eligible).toBe(0);
    },
  );

  it('paginates deterministically and invalidates profile, preferences, job and feature changes', async () => {
    const { dataset, matcher, input, backfill } = await setup();
    const first = await matcher.execute(input);

    expect(first.nextCursor).not.toBeNull();

    const next = await matcher.execute({ ...input, cursor: first.nextCursor! });

    expect(next.items[0]!.job.id).not.toBe(first.items[0]!.job.id);
    expect(next.nextCursor).toBeNull();

    for (const changes of [
      { employerContext: true },
      { profile: { ...input.profile, location: { ...input.profile.location, value: 'Berlin' } } },
    ]) {
      await expect(
        matcher.execute({ ...input, ...changes, cursor: first.nextCursor! }),
      ).rejects.toMatchObject({ code: 'cursor_stale' });
    }

    dataset.jobs[0]!.contentHash = 'updated';
    dataset.version++;

    await expect(matcher.execute({ ...input, cursor: first.nextCursor! })).rejects.toMatchObject({
      code: 'cursor_stale',
    });

    expect((await matcher.execute(input)).unenriched).toBe(1);
    await backfill.execute();
    expect((await matcher.execute(input)).unenriched).toBe(0);
    expect(await backfill.execute()).toEqual({ inspected: 0, updated: 0 });
  });

  it('rejects forged cursors and stale hashes at projection publication', async () => {
    const { dataset, features, matcher, input } = await setup();
    const projection = featureJob().requirements;

    projection.contentHash = dataset.jobs[0]!.contentHash;
    dataset.jobs[0]!.contentHash = 'changed-during-extraction';
    expect(await features.saveFeatures([{ postingId: '1', requirements: projection }])).toBe(0);

    await expect(matcher.execute({ ...input, cursor: 'forged.signature' })).rejects.toMatchObject({
      code: 'cursor_stale',
    });
  });

  it('rejects an in-flight version change without returning partially ranked jobs', async () => {
    const { dataset, features, input } = await setup();
    const original = features.featureJobs.bind(features);

    features.featureJobs = async (...args) => {
      const jobs = await original(...args);

      dataset.version++;

      return jobs;
    };

    const matcher = new MatchJobs(
      features,
      [],
      [source],
      'postgres',
      () => new Date('2026-10-01T01:00:00.000Z'),
    );

    await expect(matcher.execute(input)).rejects.toMatchObject({ code: 'cursor_stale' });
  });

  it('scans 25,000 eligible features in bounded chunks and returns the best page', async () => {
    const total = 25_000;
    const template = featureJob();

    const repository: JobFeatureRepository = {
      pendingFeatures: async () => [],
      saveFeatures: async () => 0,
      latestRuns: async () => [
        {
          id: 'run',
          sourceId: 'source',
          status: 'succeeded',
          startedAt: template.lastSeenAt,
          finishedAt: template.lastSeenAt,
          enumerationComplete: true,
          removalsQuarantined: false,
          listingCount: total,
          excludedCount: 0,
          error: null,
        },
      ],
      featureSnapshot: async () => ({
        datasetVersion: 1,
        generation: 1,
        eligible: total,
        unenriched: 0,
      }),
      featureJobs: async (_filter, after, limit) => {
        const start = after ? Number(after) + 1 : 0;

        return Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, index) => ({
          ...template,
          id: String(start + index).padStart(6, '0'),
        }));
      },
    };

    const matcher = new MatchJobs(
      repository,
      [],
      [source],
      'postgres',
      () => new Date('2026-10-01T01:00:00.000Z'),
    );

    const start = performance.now();

    const result = await matcher.execute({
      profile: candidate(),
      categories: ['engineering'],
      employerContext: false,
      limit: 20,
    });

    expect(result.evaluated).toBe(total);
    expect(result.items).toHaveLength(20);

    expect(result.items.map((item) => item.job.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => String(index).padStart(6, '0')),
    );

    expect(
      result.items.every(
        (item, index, all) => index === 0 || compareMatches(all[index - 1]!, item) <= 0,
      ),
    ).toBe(true);

    expect(performance.now() - start).toBeLessThan(10_000);
  });
});
