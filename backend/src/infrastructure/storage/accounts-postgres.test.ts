import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { PostgresAccounts } from './accounts-postgres.js';
import type { AccountSession, VerifiedIdentity } from '../../domain/accounts/identity.js';
import { accountSecretHash } from '../../application/accounts/accounts.js';

const connectionString = process.env['TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;
const now = new Date('2026-10-05T12:00:00Z');

integration('PostgreSQL account identity and session concurrency', () => {
  let first: PostgresAccounts;
  let second: PostgresAccounts;
  let client: pg.Client;
  const createdUsers = new Set<string>();

  beforeAll(async () => {
    if (
      !connectionString ||
      !/^\/jobbely_test_[a-z0-9_]+$/.test(new URL(connectionString).pathname)
    ) {
      throw new Error('Integration tests require a dedicated jobbely_test_* database');
    }

    client = new pg.Client({ connectionString });
    await client.connect();

    const existing = await client.query(`SELECT to_regclass('"AccountUser"') AS table`);

    if (!existing.rows[0]?.table) {
      await client.query(
        await readFile(
          new URL(
            '../../../prisma/migrations/202610050001_accounts/migration.sql',
            import.meta.url,
          ),
          'utf8',
        ),
      );
    }

    first = new PostgresAccounts(connectionString);
    second = new PostgresAccounts(connectionString);
  });

  afterAll(async () => {
    for (const userId of createdUsers) {
      await client.query('DELETE FROM "ApplicationSession" WHERE "userId" = $1', [userId]);
      await client.query('DELETE FROM "AccountIdentity" WHERE "userId" = $1', [userId]);
      await client.query('DELETE FROM "AccountUser" WHERE "id" = $1', [userId]);
    }

    await first?.close();
    await second?.close();
    await client?.end();
  });

  function identity(): VerifiedIdentity {
    return {
      provider: 'github',
      issuer: 'https://github.com',
      subject: randomUUID(),
      email: 'synthetic@example.invalid',
    };
  }

  function session(): Omit<AccountSession, 'user'> {
    return {
      tokenHash: accountSecretHash(randomUUID()),
      csrfToken: randomUUID(),
      idleExpiresAt: '2026-10-12T12:00:00.000Z',
      absoluteExpiresAt: '2026-11-04T12:00:00.000Z',
      revokedAt: null,
    };
  }

  async function create() {
    const result = await first.createSession(identity(), session());

    createdUsers.add(result.user.id);

    return result;
  }

  it('creates one identity across concurrent first logins without merging email addresses', async () => {
    const sameIdentity = identity();

    const results = await Promise.all([
      first.createSession(sameIdentity, session()),
      second.createSession(sameIdentity, session()),
    ]);

    results.forEach((item) => createdUsers.add(item.user.id));
    expect(results[0]!.user.id).toBe(results[1]!.user.id);

    const unrelated = await create();

    expect(unrelated.user.id).not.toBe(results[0]!.user.id);
  });

  it('consumes a browser/provider-bound OAuth attempt once across independent connections', async () => {
    const stateHash = accountSecretHash(randomUUID());
    const browserHash = accountSecretHash(randomUUID());

    await first.saveAttempt(
      {
        stateHash,
        browserHash,
        provider: 'github',
        verifier: 'synthetic-verifier',
        nonce: 'synthetic-nonce',
        expiresAt: '2026-10-05T12:10:00Z',
      },
      now,
    );

    expect(await second.consumeAttempt(stateHash, 'wrong-browser', 'github', now)).toBeNull();
    expect(await second.consumeAttempt(stateHash, browserHash, 'linkedin', now)).toBeNull();

    const results = await Promise.all([
      first.consumeAttempt(stateHash, browserHash, 'github', now),
      second.consumeAttempt(stateHash, browserHash, 'github', now),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('never revives a revoked session after concurrent refresh and logout', async () => {
    const result = await create();

    await Promise.all([
      first.readSession(result.tokenHash, now),
      second.revokeSession(result.tokenHash, now),
    ]);

    expect(await first.readSession(result.tokenHash, now)).toBeNull();
  });

  it('checks account state on each read and refuses disabled-user sign-in', async () => {
    const claim = identity();
    const result = await first.createSession(claim, session());

    createdUsers.add(result.user.id);

    await client.query('UPDATE "AccountUser" SET "state" = $1 WHERE "id" = $2', [
      'disabled',
      result.user.id,
    ]);

    expect(await second.readSession(result.tokenHash, now)).toBeNull();
    await expect(second.createSession(claim, session())).rejects.toThrow('active account');
  });

  it('does not revive idle-expired sessions or extend the absolute boundary', async () => {
    const idleExpired = await create();

    expect(
      await second.readSession(idleExpired.tokenHash, new Date(idleExpired.idleExpiresAt)),
    ).toBeNull();

    const active = await create();

    for (const day of ['11', '17', '23', '29']) {
      expect(
        await second.readSession(active.tokenHash, new Date(`2026-10-${day}T12:00:00Z`)),
      ).not.toBeNull();
    }

    expect(
      (await first.readSession(active.tokenHash, new Date('2026-11-03T12:00:00Z')))?.idleExpiresAt,
    ).toBe(active.absoluteExpiresAt);

    expect(
      await second.readSession(active.tokenHash, new Date(active.absoluteExpiresAt)),
    ).toBeNull();
  });
});
