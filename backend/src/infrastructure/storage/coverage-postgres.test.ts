import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { PostgresCoverage } from './coverage-postgres.js';
import type { CoverageAssessment } from '../../ports/coverage.js';

const connectionString = process.env['TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;

integration('persistent automatic coverage (isolated PostgreSQL)', () => {
  const companySlug = `coverage-${randomUUID()}`;
  let first: PostgresCoverage;
  let second: PostgresCoverage;
  let changed: PostgresCoverage;

  const result: CoverageAssessment = {
    companySlug,
    configurationHash: 'config',
    checkedAt: '2026-10-06T11:00:00Z',
    status: 'verified',
    sourceRunIds: { source: 'run-1' },
    blockers: [],
    accessStatus: 'unreviewed',
  };

  beforeAll(async () => {
    if (
      !connectionString ||
      !/^\/jobbely_test_[a-z0-9_]+$/.test(new URL(connectionString).pathname)
    ) {
      throw new Error('Coverage tests require a dedicated jobbely_test_* database');
    }

    const client = new pg.Client({ connectionString });

    await client.connect();

    try {
      const exists = await client.query(`SELECT to_regclass('"CompanyCoverage"') AS table`);

      if (!exists.rows[0]?.table) {
        await client.query(
          await readFile(
            new URL(
              '../../../prisma/migrations/202610060001_automatic_coverage/migration.sql',
              import.meta.url,
            ),
            'utf8',
          ),
        );
      }
    } finally {
      await client.end();
    }

    first = new PostgresCoverage(connectionString, new Map([[companySlug, 'config']]));
    second = new PostgresCoverage(connectionString, new Map([[companySlug, 'config']]));
    changed = new PostgresCoverage(connectionString, new Map([[companySlug, 'changed-config']]));
  });

  afterAll(async () => {
    await Promise.all([first?.close(), second?.close(), changed?.close()]);

    if (!connectionString) {
      return;
    }

    const client = new pg.Client({ connectionString });

    await client.connect();

    try {
      await client.query('DELETE FROM "CompanyCoverage" WHERE "companySlug" = $1', [companySlug]);
    } finally {
      await client.end();
    }
  });

  it('publishes live results across API/worker clients and rejects changed configurations', async () => {
    await first.save(result);
    expect(await second.read()).toContainEqual(result);
    expect(await changed.read()).not.toContainEqual(result);
  });

  it('preserves newer revocations when an older audit finishes late', async () => {
    const revoked = {
      ...result,
      checkedAt: '2026-10-06T12:00:00Z',
      status: 'partial' as const,
      blockers: ['Missing official job'],
    };

    await Promise.all([second.save(revoked), first.save(result)]);
    expect((await first.read()).find((row) => row.companySlug === companySlug)).toEqual(revoked);
  });
});
