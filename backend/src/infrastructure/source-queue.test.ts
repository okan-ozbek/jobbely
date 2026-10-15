import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import { PgBoss } from 'pg-boss';
import { configureSourceRefreshQueue, sourceRefreshQueue } from './source-queue.js';

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
});
