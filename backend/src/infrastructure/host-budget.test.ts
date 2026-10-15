import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { PostgresHostBudget } from './host-budget.js';

const connectionString = process.env['TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;

integration('shared host pacing (isolated PostgreSQL)', () => {
  let first: PostgresHostBudget;
  let second: PostgresHostBudget;

  beforeAll(async () => {
    if (
      !connectionString ||
      !/^\/jobbely_test_[a-z0-9_]+$/.test(new URL(connectionString).pathname)
    ) {
      throw new Error('Dedicated test database required');
    }

    const client = new pg.Client({ connectionString });

    await client.connect();

    if (!(await client.query(`SELECT to_regclass('"HttpHostBudget"') AS table`)).rows[0].table) {
      await client.query(
        await readFile(
          new URL(
            '../../prisma/migrations/202610150002_shared_host_budget/migration.sql',
            import.meta.url,
          ),
          'utf8',
        ),
      );
    }

    await client.end();
    first = new PostgresHostBudget(connectionString);
    second = new PostgresHostBudget(connectionString);
  });

  afterAll(async () => {
    await first?.close();
    await second?.close();
  });

  it('serializes the same host across independent clients through body consumption and spaces starts', async () => {
    const host = `same-${randomUUID()}.example`;
    const starts: number[] = [];
    let active = 0;
    let peak = 0;

    const request = async () => {
      starts.push(Date.now());
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 100));
      active--;
    };

    await Promise.all([first.run(host, request), second.run(host, request)]);
    expect(peak).toBe(1);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(950);
  });

  it('allows different hosts concurrently and releases ownership after failures', async () => {
    let active = 0;
    let peak = 0;

    const request = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 100));
      active--;
    };

    await Promise.all([
      first.run(`${randomUUID()}.example`, request),
      second.run(`${randomUUID()}.example`, request),
    ]);

    expect(peak).toBe(2);

    const host = `failed-${randomUUID()}.example`;

    await expect(
      first.run(host, async () => {
        throw new Error('Network unavailable');
      }),
    ).rejects.toThrow('Network unavailable');

    expect(await second.run(host, async () => 42)).toBe(42);
  });

  it('shares long Retry-After cooldowns instead of sending another replica early', async () => {
    const host = `cooldown-${randomUUID()}.example`;
    const error = Object.assign(new Error('Rate limited'), { retryAfterMs: 60_000 });

    await expect(
      first.run(host, async () => {
        throw error;
      }),
    ).rejects.toThrow('Rate limited');

    let called = false;

    await expect(
      second.run(host, async () => {
        called = true;
      }),
    ).rejects.toThrow('cooldown');

    expect(called).toBe(false);
  });
});
