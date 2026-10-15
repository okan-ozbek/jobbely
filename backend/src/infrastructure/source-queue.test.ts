import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import { PgBoss } from 'pg-boss';
import {
  configureSourceRefreshQueue,
  sourceRefreshQueue,
  companyRefreshQueue,
} from './source-queue.js';
import { CompanyRefreshQueue } from './company-refresh-queue.js';
import type { CompanyRefreshTask } from './company-refresh-queue.js';
import type { Company, Source } from '../domain/model.js';

const connectionString = process.env['TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;

integration('ordered source queue (isolated PostgreSQL)', () => {
  const schema = `source_test_${randomUUID().replaceAll('-', '')}`;
  let first: PgBoss;
  let second: PgBoss;

  let release: () => void = () => {};

  beforeAll(async () => {
    if (
      !connectionString ||
      !/^\/jobbely_test_[a-z0-9_]+$/.test(new URL(connectionString).pathname)
    ) {
      throw new Error('Source queue tests require an isolated jobbely_test_* database');
    }

    first = new PgBoss({ connectionString, schema });
    second = new PgBoss({ connectionString, schema });

    first.on('error', () => {});
    second.on('error', () => {});
    await first.start();
    await second.start();
    await configureSourceRefreshQueue(first);
    await configureSourceRefreshQueue(second);
    await first.schedule(sourceRefreshQueue, '0 */12 * * *', null, { tz: 'UTC' });
  });

  afterAll(async () => {
    release();
    await first?.stop();
    await second?.stop();

    const client = new pg.Client({ connectionString });

    await client.connect();
    // Only the random schema created by this test is removed.
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  });

  it('suppresses duplicate queued and active cycles across clients and permits the next cycle', async () => {
    const firstId = await first.send(sourceRefreshQueue);

    expect(firstId).not.toBeNull();
    expect(await second.send(sourceRefreshQueue)).toBeNull();

    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    let active = false;

    await first.work(sourceRefreshQueue, { pollingIntervalSeconds: 0.5 }, async () => {
      active = true;
      await gate;
    });

    await vi.waitFor(() => expect(active).toBe(true), { timeout: 10_000 });
    expect(await second.send(sourceRefreshQueue)).toBeNull();
    release();

    await vi.waitFor(
      async () => {
        const job = await first.getJobById(sourceRefreshQueue, firstId!);

        expect(job?.state).toBe('completed');
      },
      { timeout: 10_000 },
    );

    expect(await second.send(sourceRefreshQueue)).not.toBeNull();

    const [schedule] = await second.getSchedules(sourceRefreshQueue);

    expect(schedule?.cron).toBe('0 */12 * * *');
    expect(schedule?.timezone).toBe('UTC');
  }, 30_000);

  it('shares companies across two consumers, prevents concurrent duplicate company claims, and resumes without redispatch', async () => {
    const companies: Company[] = Array.from({ length: 8 }, (_, index) => ({
      slug: `synthetic-${index}`,
      name: `Synthetic ${index}`,
      careersUrl: 'https://example.invalid/careers',
      logoUrl: '/logos/default.svg',
      wave: 'D',
    }));

    const sources: Source[] = companies.map((company) => ({
      id: company.slug,
      companySlug: company.slug,
      provider: 'ashby',
      board: company.slug,
      scheduled: true,
      auditStatus: 'candidate',
    }));

    const seen = new Map<string, number>();
    const active = new Set<string>();
    const workers = [0, 0];
    let peak = 0;

    const handle = (worker: number) => async (jobs: { id: string; data: CompanyRefreshTask }[]) => {
      const job = jobs[0]!;

      expect(active.has(job.data.companySlug)).toBe(false);
      active.add(job.data.companySlug);
      peak = Math.max(peak, active.size);
      workers[worker] = (workers[worker] ?? 0) + 1;
      seen.set(job.id, (seen.get(job.id) ?? 0) + 1);
      await new Promise((resolve) => setTimeout(resolve, 150));
      active.delete(job.data.companySlug);

      return {
        id: job.id,
        status: 'succeeded',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        current: null,
        companies: [
          {
            company: job.data.companySlug,
            sources: [],
            audit: { status: 'passed', blockers: [], reportPath: null },
          },
        ],
        backfillError: null,
        error: null,
      };
    };

    await first.work<CompanyRefreshTask>(
      companyRefreshQueue,
      { localConcurrency: 1, pollingIntervalSeconds: 0.5 },
      handle(0),
    );

    await second.work<CompanyRefreshTask>(
      companyRefreshQueue,
      { localConcurrency: 1, pollingIntervalSeconds: 0.5 },
      handle(1),
    );

    const cycleId = randomUUID();

    const controller = new AbortController();

    const interrupted = new CompanyRefreshQueue(
      first,
      companies,
      sources,
      {
        save: async (report) => {
          if (report.status === 'running') {
            controller.abort(new Error('Coordinator interrupted'));
          }
        },
      },
      { execute: async () => {} },
    );

    await expect(interrupted.execute(cycleId, controller.signal)).rejects.toThrow();

    const coordinator = new CompanyRefreshQueue(
      first,
      companies,
      sources,
      { save: async () => {} },
      { execute: async () => {} },
    );

    expect((await coordinator.execute(cycleId)).status).toBe('succeeded');
    expect(seen.size).toBe(8);
    expect([...seen.values()].every((count) => count === 1)).toBe(true);
    expect(workers.every((count) => count > 0)).toBe(true);
    expect(peak).toBe(2);
    expect((await coordinator.execute(cycleId)).status).toBe('succeeded');
    expect(seen.size).toBe(8);
    expect([...seen.values()].every((count) => count === 1)).toBe(true);

    // Two different jobs for the same company (e.g. after a coordinator failure)
    // must remain serialized even while both clients are polling.
    const duplicateIds = await first.insert(
      companyRefreshQueue,
      [0, 1].map(() => ({
        singletonKey: 'same-company',
        data: { cycleId: randomUUID(), companySlug: 'same-company', registryHash: 'test' },
      })),
      { returnId: true },
    );

    await vi.waitFor(
      async () => {
        const jobs = await Promise.all(
          duplicateIds!.map((id) => first.getJobById(companyRefreshQueue, id)),
        );

        expect(jobs.every((job) => job?.state === 'completed')).toBe(true);
      },
      { timeout: 10_000 },
    );

    await first.offWork(companyRefreshQueue);
    await second.offWork(companyRefreshQueue);
  }, 30_000);
});
