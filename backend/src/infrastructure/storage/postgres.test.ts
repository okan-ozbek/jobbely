import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { PostgresJobRepository } from './postgres.js';
import { PostgresJobFeatures } from './feature-postgres.js';
import { extractRequirements } from '../../domain/matching/requirements.js';
import type { NormalizedPosting, Source } from '../../domain/model.js';

const connectionString = process.env['TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;

integration('PostgreSQL transactions (isolated test database)', () => {
  let repository: PostgresJobRepository;
  let secondRepository: PostgresJobRepository;
  let features: PostgresJobFeatures;

  beforeAll(async () => {
    if (
      !connectionString ||
      !/^\/jobbely_test_[a-z0-9_]+$/.test(new URL(connectionString).pathname)
    ) {
      throw new Error('Integration tests require a dedicated jobbely_test_* database');
    }

    const client = new pg.Client({ connectionString });

    await client.connect();

    const existing = await client.query(`SELECT to_regclass('"DatasetVersion"') AS table`);

    if (!existing.rows[0]?.table) {
      await client.query(
        await readFile(
          new URL('../../../prisma/migrations/202609300001_initial/migration.sql', import.meta.url),
          'utf8',
        ),
      );
    }

    const featureTable = await client.query(`SELECT to_regclass('"JobFeature"') AS table`);

    if (!featureTable.rows[0]?.table) {
      await client.query(
        await readFile(
          new URL(
            '../../../prisma/migrations/202610010001_job_features/migration.sql',
            import.meta.url,
          ),
          'utf8',
        ),
      );
    }

    await client.end();
    repository = new PostgresJobRepository(connectionString);
    secondRepository = new PostgresJobRepository(connectionString);
    features = new PostgresJobFeatures(connectionString);
  });

  afterAll(async () => {
    await repository?.close();
    await secondRepository?.close();
    await features?.close();
  });

  const source = (): Source => ({
    id: randomUUID(),
    companySlug: 'test',
    provider: 'greenhouse',
    board: 'test',
    auditStatus: 'verified',
    scheduled: false,
  });

  const posting = (id: string): NormalizedPosting => ({
    sourcePostingId: id,
    title: 'Engineer',
    url: 'https://example.com/job',
    applyUrl: 'https://example.com/apply',
    descriptionHtml: '<p>Description</p>',
    descriptionText: 'Description',
    departments: ['Engineering'],
    locations: ['Amsterdam'],
    workplace: 'unknown',
    employment: 'unknown',
    publishedAt: null,
    classification: {
      category: 'engineering',
      method: 'source_mapping',
      rule: 'label:engineering',
      evidence: 'Engineering',
      version: '1',
    },
    contentHash: 'unchanged',
  });

  it('grants one lease across independent clients', async () => {
    const item = source();
    const at = new Date().toISOString();

    const claims = await Promise.all([
      repository.startRun(item, at),
      secondRepository.startRun(item, at),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    await repository.failRun(claims.find(Boolean)!.id, at, 'test cleanup');
  });

  it('publishes projections once across concurrent writers and invalidates changed content', async () => {
    const item = source();
    const at = new Date().toISOString();
    const first = await repository.startRun(item, at);
    const records = [posting('projected')];

    await repository.commitSnapshot({
      source: item,
      runId: first!.id,
      observedAt: at,
      postings: records,
      rawResponses: [],
      excluded: 0,
      enumerationComplete: true,
    });

    const job = (await repository.read()).jobs.find((entry) => entry.sourceId === item.id)!;
    const feature = { postingId: job.id, requirements: extractRequirements(job) };

    const filter = {
      sourceIds: [item.id],
      cutoff: '1900-01-01T00:00:00.000Z',
      categories: ['engineering'],
    };

    const before = await features.featureSnapshot(filter);

    const writes = await Promise.all([
      features.saveFeatures([feature]),
      features.saveFeatures([feature]),
    ]);

    expect(writes.sort()).toEqual([0, 1]);

    const enriched = await features.featureSnapshot(filter);

    expect(enriched).toMatchObject({
      eligible: 1,
      unenriched: 0,
      generation: before.generation + 1,
    });

    expect((await features.featureJobs(filter, '', 10))[0]!.id).toBe(job.id);

    const second = await repository.startRun(item, at);

    await repository.commitSnapshot({
      source: item,
      runId: second!.id,
      observedAt: at,
      postings: [
        {
          ...records[0]!,
          contentHash: 'changed-for-feature',
          descriptionText: 'Requirements\nPython required.',
        },
      ],
      rawResponses: [],
      excluded: 0,
      enumerationComplete: true,
    });

    expect((await features.featureSnapshot(filter)).unenriched).toBe(1);
    expect(await features.featureJobs(filter, '', 10)).toEqual([]);
    expect(await features.saveFeatures([feature])).toBe(0);

    const changed = (await repository.read()).jobs.find((entry) => entry.id === job.id)!;

    expect(
      await features.saveFeatures([
        { postingId: job.id, requirements: extractRequirements(changed) },
      ]),
    ).toBe(1);

    expect(
      (await features.featureJobs(filter, '', 10))[0]!.requirements.skills[0]!.alternatives[0]!.id,
    ).toBe('python');
  });

  it('serializes projection publication with ingestion without exposing stale hashes', async () => {
    const item = source();
    const at = new Date().toISOString();
    const initial = await repository.startRun(item, at);
    const record = posting('race');

    await repository.commitSnapshot({
      source: item,
      runId: initial!.id,
      observedAt: at,
      postings: [record],
      rawResponses: [],
      excluded: 0,
      enumerationComplete: true,
    });

    const job = (await repository.read()).jobs.find((entry) => entry.sourceId === item.id)!;
    const next = await repository.startRun(item, at);

    await Promise.all([
      features.saveFeatures([{ postingId: job.id, requirements: extractRequirements(job) }]),
      repository.commitSnapshot({
        source: item,
        runId: next!.id,
        observedAt: at,
        postings: [{ ...record, contentHash: 'race-new' }],
        rawResponses: [],
        excluded: 0,
        enumerationComplete: true,
      }),
    ]);

    const filter = {
      sourceIds: [item.id],
      cutoff: '1900-01-01T00:00:00.000Z',
      categories: ['engineering'],
    };

    expect(await features.featureJobs(filter, '', 10)).toEqual([]);
    expect((await features.featureSnapshot(filter)).unenriched).toBe(1);
  });

  it('renews only the current unexpired owner during long imports', async () => {
    const item = source();
    const started = new Date();
    const run = await repository.startRun(item, started.toISOString());
    const later = new Date(started.getTime() + 20 * 60_000).toISOString();

    expect(await secondRepository.renewRun(item.id, 'wrong-owner', later)).toBe(false);
    expect(await repository.renewRun(item.id, run!.id, later)).toBe(true);

    expect(
      await secondRepository.startRun(
        item,
        new Date(started.getTime() + 35 * 60_000).toISOString(),
      ),
    ).toBeNull();

    expect(
      await repository.renewRun(
        item.id,
        run!.id,
        new Date(started.getTime() + 51 * 60_000).toISOString(),
      ),
    ).toBe(false);

    await repository.failRun(run!.id, later, 'test cleanup');
  });

  it('persists POST offsets and facets together with the exact response evidence', async () => {
    const item = source();
    const at = new Date().toISOString();
    const run = await repository.startRun(item, at);

    const request = {
      method: 'POST' as const,
      body: { offset: 20, appliedFacets: { jobFamilyGroup: ['engineering'] } },
    };

    const body = {
      total: 0,
      jobPostings: [{ title: 'Engineer', externalPath: '/job/London/Engineer_1' }],
    };

    await repository.commitSnapshot({
      source: item,
      runId: run!.id,
      observedAt: at,
      postings: [posting('1')],
      rawResponses: [{ url: 'https://example.com/jobs', fetchedAt: at, request, body }],
      excluded: 0,
      enumerationComplete: true,
    });

    const client = new pg.Client({ connectionString });

    await client.connect();

    try {
      const result = await client.query('SELECT payload FROM "Snapshot" WHERE "runId" = $1', [
        run!.id,
      ]);

      expect(result.rows[0]?.payload).toEqual({ format: 'http-exchange-v1', request, body });
    } finally {
      await client.end();
    }
  });

  it('rolls back the whole snapshot on duplicate IDs, including version publication', async () => {
    const item = source();
    const at = new Date().toISOString();
    const run = await repository.startRun(item, at);
    const version = (await repository.read()).version;

    await expect(
      repository.commitSnapshot({
        source: item,
        runId: run!.id,
        observedAt: at,
        postings: [posting('1'), posting('1')],
        rawResponses: [],
        excluded: 0,
        enumerationComplete: true,
      }),
    ).rejects.toThrow('Duplicate');

    const after = await secondRepository.read();

    expect(after.version).toBe(version);
    expect(after.jobs.some((job) => job.sourceId === item.id)).toBe(false);
    await repository.failRun(run!.id, at, 'test cleanup');
  });

  it('persists stable identity and missing observations across independent repository instances', async () => {
    const item = source();

    async function commit(at: string, ids: string[]) {
      const run = await repository.startRun(item, at);

      return repository.commitSnapshot({
        source: item,
        runId: run!.id,
        observedAt: at,
        postings: ids.map(posting),
        rawResponses: [{ url: 'https://example.com/feed', fetchedAt: at, body: { ids } }],
        excluded: 0,
        enumerationComplete: true,
      });
    }

    await commit('2026-09-30T12:00:00.000Z', ['1', '2', '3', '4']);

    const original = (await secondRepository.read()).jobs.find(
      (job) => job.sourceId === item.id && job.sourcePostingId === '4',
    )!;

    await commit('2026-10-01T12:00:00.000Z', ['1', '2', '3']);
    await commit('2026-10-02T12:00:00.000Z', ['1', '2', '3']);

    expect(
      (await secondRepository.read()).jobs.find((job) => job.id === original.id),
    ).toMatchObject({ status: 'closed', missingCount: 2 });

    await commit('2026-10-02T13:00:00.000Z', ['1', '2', '3', '4']);

    expect(
      (await secondRepository.read()).jobs.find((job) => job.id === original.id),
    ).toMatchObject({ status: 'active', firstSeenAt: original.firstSeenAt });
  });

  it('rolls back postings already written when raw evidence persistence fails', async () => {
    const item = source();
    const at = new Date().toISOString();
    const run = await repository.startRun(item, at);
    const version = (await repository.read()).version;

    await expect(
      repository.commitSnapshot({
        source: item,
        runId: run!.id,
        observedAt: at,
        postings: Array.from({ length: 280 }, (_, index) => posting(String(index))),
        rawResponses: [
          {
            url: 'https://example.com/feed',
            fetchedAt: 'invalid date',
            body: {},
          },
        ],
        excluded: 0,
        enumerationComplete: true,
      }),
    ).rejects.toThrow();

    const after = await secondRepository.read();

    expect(after.version).toBe(version);
    expect(after.jobs.some((job) => job.sourceId === item.id)).toBe(false);
    expect(after.runs.find((row) => row.id === run!.id)?.status).toBe('running');
    await repository.failRun(run!.id, at, 'test cleanup');
  });

  it('publishes across batches and updates one version without changing stable identities', async () => {
    const item = source();
    const at = new Date().toISOString();
    const records = Array.from({ length: 280 }, (_, index) => posting(String(index)));
    const first = await repository.startRun(item, at);

    await repository.commitSnapshot({
      source: item,
      runId: first!.id,
      observedAt: at,
      postings: records,
      rawResponses: [],
      excluded: 0,
      enumerationComplete: true,
    });

    const original = (await secondRepository.read()).jobs.filter((job) => job.sourceId === item.id);

    expect(original).toHaveLength(280);

    const updated = records.map((record, index) =>
      index === 279 ? { ...record, title: "Engineer's new role", contentHash: 'changed' } : record,
    );

    const second = await repository.startRun(item, at);

    await repository.commitSnapshot({
      source: item,
      runId: second!.id,
      observedAt: at,
      postings: updated,
      rawResponses: [],
      excluded: 0,
      enumerationComplete: true,
    });

    const current = (await secondRepository.read()).jobs.filter((job) => job.sourceId === item.id);

    expect(new Set(current.map((job) => job.id))).toEqual(new Set(original.map((job) => job.id)));
    expect(current.find((job) => job.sourcePostingId === '279')?.title).toBe("Engineer's new role");

    const client = new pg.Client({ connectionString });

    await client.connect();

    try {
      const result = await client.query(
        'SELECT count(*)::int AS count FROM "PostingVersion" v JOIN "Posting" p ON p.id=v."postingId" WHERE p."sourceId"=$1',
        [item.id],
      );

      expect(result.rows[0]?.count).toBe(281);
    } finally {
      await client.end();
    }
  });
});
