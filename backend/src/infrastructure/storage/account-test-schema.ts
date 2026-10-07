import { readFile } from 'node:fs/promises';
import type pg from 'pg';

/** Isolated integration fixture setup, serialized across test files. */
export async function ensureAccountTestSchema(client: pg.Client) {
  await client.query('BEGIN');

  try {
    await client.query('SELECT pg_advisory_xact_lock(2715001)');

    for (const [table, migration] of [
      ['AccountUser', '202610050001_accounts'],
      ['EmailChallenge', '202610050002_password_accounts'],
    ]) {
      const existing = await client.query('SELECT to_regclass($1) AS table', [`"${table}"`]);

      if (!existing.rows[0]?.table) {
        await client.query(
          await readFile(
            new URL(`../../../prisma/migrations/${migration}/migration.sql`, import.meta.url),
            'utf8',
          ),
        );
      }
    }

    const emailChange = await client.query(
      `SELECT 1 FROM pg_constraint WHERE conrelid = '"EmailChallenge"'::regclass AND conname = 'EmailChallenge_purpose_check' AND pg_get_constraintdef(oid) LIKE '%change-email%'`,
    );

    if (!emailChange.rowCount) {
      await client.query(
        await readFile(
          new URL(
            '../../../prisma/migrations/202610070001_email_change/migration.sql',
            import.meta.url,
          ),
          'utf8',
        ),
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');

    throw error;
  }
}
