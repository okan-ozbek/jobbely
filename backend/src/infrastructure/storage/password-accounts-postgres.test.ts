import { createHash, createHmac, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { PostgresPasswordAccounts } from './password-accounts-postgres.js';
import { PostgresAccounts } from './accounts-postgres.js';
import { ensureAccountTestSchema } from './account-test-schema.js';
import { PasswordAccounts } from '../../application/accounts/password-accounts.js';
import { EncryptedAccountEmail } from '../accounts/email-cipher.js';
import { AccountEmailQueue } from '../accounts/account-email-queue.js';
import type { AccountEmail, PasswordHasher } from '../../ports/password-accounts.js';
import { createApp } from '../../api/app.js';
import { JobCatalog } from '../../application/catalog.js';
import { MemoryJobRepository } from './memory.js';
import { Accounts, accountSecretHash } from '../../application/accounts/accounts.js';

const connectionString = process.env['TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;
const secret = 'isolated-synthetic-test-secret-with-32-chars';
const cipher = new EncryptedAccountEmail(secret);
const password = 'synthetic-long-passphrase1!';

// Flow/concurrency tests isolate cryptographic cost; real scrypt is tested separately.
const hasher: PasswordHasher = {
  hash: async (input) => createHash('sha256').update(`test-only:${input}`).digest('hex'),
  verify: async (input, hash) =>
    createHash('sha256').update(`test-only:${input}`).digest('hex') === hash,
};

integration('native registration, recovery and transactional email queue', () => {
  let first: PostgresPasswordAccounts;
  let second: PostgresPasswordAccounts;
  let accounts: PostgresAccounts;
  let client: pg.Client;
  let now = new Date();
  const emails: string[] = [];
  const mailbox: AccountEmail[] = [];
  let native: PasswordAccounts;
  let other: PasswordAccounts;

  beforeAll(async () => {
    if (
      !connectionString ||
      !/^\/jobbely_test_[a-z0-9_]+$/.test(new URL(connectionString).pathname)
    ) {
      throw new Error('Integration tests require a dedicated jobbely_test_* database');
    }

    client = new pg.Client({ connectionString });
    await client.connect();
    await ensureAccountTestSchema(client);
    first = new PostgresPasswordAccounts(connectionString);
    second = new PostgresPasswordAccounts(connectionString);
    accounts = new PostgresAccounts(connectionString);
    native = new PasswordAccounts(first, hasher, cipher, secret, () => now);
    other = new PasswordAccounts(second, hasher, cipher, secret, () => now);
  });

  afterAll(async () => {
    for (const email of emails) {
      const credentials = await first.client.passwordCredential.findUnique({ where: { email } });

      const pending = await first.client.emailChallenge.findMany({
        where: { email },
        select: { tokenHash: true },
      });

      await first.client.accountEmailJob.deleteMany({
        where: { challengeHash: { in: pending.map((row) => row.tokenHash) } },
      });

      await first.client.emailChallenge.deleteMany({ where: { email } });

      if (credentials) {
        await first.client.applicationSession.deleteMany({ where: { userId: credentials.userId } });
        await first.client.passwordCredential.delete({ where: { email } });
        await first.client.accountUser.delete({ where: { id: credentials.userId } });
      }
    }

    await first?.close();
    await second?.close();
    await accounts?.close();
    await client?.end();
  });

  function email() {
    const value = `${randomUUID()}@example.invalid`;

    emails.push(value);

    return value;
  }

  async function delivered(to: string) {
    const queue = new AccountEmailQueue(
      first.client,
      cipher,
      {
        send: async (message) => {
          mailbox.push(message);
        },
      },
      () => now,
    );

    for (let attempts = 0; attempts < 30; attempts++) {
      const result = await queue.deliverOne();

      if (result === 'idle') {
        break;
      }
    }

    return mailbox.filter((message) => message.to === to).at(-1)!;
  }

  async function registered(to = email()) {
    const start = await native.requestCode('register', { email: to, password }, randomUUID());

    const mail = await delivered(to);
    const session = await native.confirm(start.challenge, mail.code, start.browser, randomUUID());

    return { to, start, session };
  }

  it('requires API Origin and CSRF for email changes and returns a fresh HttpOnly session after confirmation', async () => {
    const original = await registered();
    const origin = 'https://example.invalid';
    const repository = new MemoryJobRepository();

    const app = await createApp({
      repository,
      catalog: new JobCatalog(repository, [], [], 'demo'),
      origin,
      accounts: new Accounts(accounts, [], () => now),
      passwordAccounts: native,
    });

    const cookie = `__Host-jobbely_session=${original.session.token}`;
    const csrf = original.session.session.csrfToken;
    const destination = email();

    try {
      expect(
        (await app.inject({ url: '/api/v1/account', headers: { cookie } })).json().user.hasPassword,
      ).toBe(true);

      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/account/email/change',
            headers: { origin, cookie },
            payload: { email: destination, password },
          })
        ).statusCode,
      ).toBe(401);

      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/account/email/change',
            headers: { cookie, 'x-csrf-token': csrf },
            payload: { email: destination, password },
          })
        ).statusCode,
      ).toBe(403);

      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/account/email/change',
            headers: { origin, cookie, 'x-csrf-token': csrf },
            payload: { email: destination, password, userId: 'attacker' },
          })
        ).statusCode,
      ).toBe(400);

      const started = await app.inject({
        method: 'POST',
        url: '/api/v1/account/email/change',
        headers: { origin, cookie, 'x-csrf-token': csrf },
        payload: { email: destination, password },
      });

      const mail = await delivered(destination);

      expect(started.statusCode).toBe(200);
      expect(started.body).not.toContain(mail.code);
      expect(started.body).not.toContain(password);

      const browser = `${started.cookies[0]!.name}=${started.cookies[0]!.value}`;

      const confirmed = await app.inject({
        method: 'POST',
        url: '/api/v1/account/email/confirm',
        headers: { origin, cookie: `${cookie}; ${browser}`, 'x-csrf-token': csrf },
        payload: { challenge: started.json().challenge, code: mail.code },
      });

      expect(confirmed.statusCode).toBe(200);
      expect(confirmed.json()).toEqual({ changed: true });
      expect(confirmed.cookies[0]).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax' });
      expect(confirmed.cookies[0]?.value).not.toBe(original.session.token);

      expect((await app.inject({ url: '/api/v1/account', headers: { cookie } })).statusCode).toBe(
        401,
      );

      expect(
        (
          await app.inject({
            url: '/api/v1/account',
            headers: { cookie: `${confirmed.cookies[0]!.name}=${confirmed.cookies[0]!.value}` },
          })
        ).json().user.email,
      ).toBe(destination);
    } finally {
      await app.close();
    }
  });

  it('bounds incorrect change-email codes and resolves competing owners without creating duplicate credentials', async () => {
    const original = await registered();
    const contender = await registered();
    const destination = email();

    const pending = await native.requestEmailChange(
      original.session.session,
      { email: destination, password },
      randomUUID(),
    );

    const mail = await delivered(destination);
    const wrong = mail.code === '000000' ? '111111' : '000000';

    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(
        native.confirmEmailChange(
          original.session.session,
          pending.challenge,
          wrong,
          pending.browser,
          randomUUID(),
        ),
      ).rejects.toThrow('Invalid or expired');
    }

    await expect(
      native.confirmEmailChange(
        original.session.session,
        pending.challenge,
        mail.code,
        pending.browser,
        randomUUID(),
      ),
    ).rejects.toThrow('Invalid or expired');

    const firstPending = await native.requestEmailChange(
      original.session.session,
      { email: destination, password },
      randomUUID(),
    );

    const secondPending = await other.requestEmailChange(
      contender.session.session,
      { email: destination, password },
      randomUUID(),
    );

    await delivered(destination);

    const firstMail = mailbox.findLast(
      (item) => item.to === destination && item.code !== mail.code,
    )!;

    const firstRow = await first.readChallenge(
      accountSecretHash(firstPending.challenge),
      accountSecretHash(firstPending.browser),
      now,
    );

    const secondRow = await first.readChallenge(
      accountSecretHash(secondPending.challenge),
      accountSecretHash(secondPending.browser),
      now,
    );

    const firstJob = await first.client.accountEmailJob.findFirst({
      where: { challengeHash: firstRow!.tokenHash, state: 'sent' },
    });

    // Sent job payloads are erased; match each delivered code by its purpose-bound digest.
    expect(firstJob?.sealedEmail).toBeNull();

    const codeFor = (hash: string, tokenHash: string) =>
      mailbox.find(
        (item) =>
          item.to === destination &&
          createHmac('sha256', secret)
            .update(JSON.stringify(['code', tokenHash, 'change-email', item.code]))
            .digest('hex') === hash,
      )!.code;

    const results = await Promise.allSettled([
      native.confirmEmailChange(
        original.session.session,
        firstPending.challenge,
        codeFor(firstRow!.codeHash, firstRow!.tokenHash),
        firstPending.browser,
        randomUUID(),
      ),
      other.confirmEmailChange(
        contender.session.session,
        secondPending.challenge,
        codeFor(secondRow!.codeHash, secondRow!.tokenHash),
        secondPending.browser,
        randomUUID(),
      ),
    ]);

    expect(firstMail).toBeDefined();
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await first.client.passwordCredential.count({ where: { email: destination } })).toBe(1);
  });

  it('requires password, browser and owner proof before rotating the verified address and all sessions', async () => {
    const original = await registered();
    const stranger = await registered();
    const destination = email();

    await expect(
      native.requestEmailChange(
        original.session.session,
        { email: destination, password: 'incorrect' },
        randomUUID(),
      ),
    ).rejects.toThrow('current password');

    const pending = await native.requestEmailChange(
      original.session.session,
      { email: destination, password },
      randomUUID(),
    );

    const mail = await delivered(destination);

    expect(mail.purpose).toBe('change-email');
    expect(await first.credential(destination)).toBeNull();

    await expect(
      native.confirmEmailChange(
        stranger.session.session,
        pending.challenge,
        mail.code,
        pending.browser,
        randomUUID(),
      ),
    ).rejects.toThrow('Invalid or expired');

    await expect(
      native.confirmEmailChange(
        original.session.session,
        pending.challenge,
        mail.code,
        stranger.start.browser,
        randomUUID(),
      ),
    ).rejects.toThrow('Invalid or expired');

    await expect(native.resend(pending.challenge, pending.browser, randomUUID())).rejects.toThrow(
      'Sign in',
    );

    const additional = await native.login({ email: original.to, password }, randomUUID());

    const changed = await native.confirmEmailChange(
      original.session.session,
      pending.challenge,
      mail.code,
      pending.browser,
      randomUUID(),
    );

    expect(changed.session.user.id).toBe(original.session.session.user.id);
    expect(changed.session.user.email).toBe(destination);
    expect(await first.credential(original.to)).toBeNull();

    expect(await first.credential(destination)).toMatchObject({
      userId: original.session.session.user.id,
    });

    expect(await accounts.readSession(accountSecretHash(original.session.token), now)).toBeNull();
    expect(await accounts.readSession(accountSecretHash(additional.token), now)).toBeNull();
    expect(await accounts.readSession(accountSecretHash(changed.token), now)).not.toBeNull();

    await expect(native.login({ email: original.to, password }, randomUUID())).rejects.toThrow(
      'Email or password',
    );

    expect(
      (await native.login({ email: destination, password }, randomUUID())).session.user.id,
    ).toBe(changed.session.user.id);
  });

  it('makes email-change confirmation single-use across concurrent connections and prevents address takeover', async () => {
    const original = await registered();
    const occupied = await registered();

    await expect(
      native.requestEmailChange(
        original.session.session,
        { email: occupied.to, password },
        randomUUID(),
      ),
    ).rejects.toThrow('cannot be used');

    const destination = email();

    const pending = await native.requestEmailChange(
      original.session.session,
      { email: destination, password },
      randomUUID(),
    );

    const mail = await delivered(destination);

    const results = await Promise.allSettled(
      [native, other].map((service) =>
        service.confirmEmailChange(
          original.session.session,
          pending.challenge,
          mail.code,
          pending.browser,
          randomUUID(),
        ),
      ),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await first.client.passwordCredential.count({ where: { email: destination } })).toBe(1);
    expect((await first.credential(occupied.to))?.userId).toBe(occupied.session.session.user.id);
  });

  it('rejects email changes after password reset or logout and replaces older owner challenges', async () => {
    const original = await registered();
    const destination = email();

    const pending = await native.requestEmailChange(
      original.session.session,
      { email: destination, password },
      randomUUID(),
    );

    const mail = await delivered(destination);

    const newer = await native.requestEmailChange(
      original.session.session,
      { email: email(), password },
      randomUUID(),
    );

    await expect(
      native.confirmEmailChange(
        original.session.session,
        pending.challenge,
        mail.code,
        pending.browser,
        randomUUID(),
      ),
    ).rejects.toThrow('Invalid or expired');

    const newest = await first.readChallenge(
      accountSecretHash(newer.challenge),
      accountSecretHash(newer.browser),
      now,
    );

    expect(newest?.userId).toBe(original.session.session.user.id);

    const reset = await native.requestCode('reset', { email: original.to }, randomUUID());
    const resetMail = await delivered(original.to);

    await native.reset(
      reset.challenge,
      resetMail.code,
      'new-synthetic-passphrase1!',
      reset.browser,
      randomUUID(),
    );

    await expect(
      native.confirmEmailChange(
        original.session.session,
        newer.challenge,
        (await delivered(newest!.email)).code,
        newer.browser,
        randomUUID(),
      ),
    ).rejects.toThrow('Invalid or expired');

    const loggedIn = await native.login(
      { email: original.to, password: 'new-synthetic-passphrase1!' },
      randomUUID(),
    );

    const next = await native.requestEmailChange(
      loggedIn.session,
      { email: email(), password: 'new-synthetic-passphrase1!' },
      randomUUID(),
    );

    const nextRow = await first.readChallenge(
      accountSecretHash(next.challenge),
      accountSecretHash(next.browser),
      now,
    );

    const nextMail = await delivered(nextRow!.email);

    await accounts.revokeSession(accountSecretHash(loggedIn.token), now);

    await expect(
      native.confirmEmailChange(
        loggedIn.session,
        next.challenge,
        nextMail.code,
        next.browser,
        randomUUID(),
      ),
    ).rejects.toThrow('Invalid or expired');
  });

  it('creates no usable account until code confirmation, preserves zero-leading codes and issues an opaque session once', async () => {
    const to = email();

    const start = await native.requestCode(
      'register',
      { email: to.toUpperCase(), password },
      randomUUID(),
    );

    expect(await first.credential(to)).toBeNull();

    await expect(native.login({ email: to, password }, randomUUID())).rejects.toThrow(
      'Email or password',
    );

    const job = await first.client.accountEmailJob.findFirst({
      where: { challengeHash: accountSecretHash(start.challenge) },
    });

    expect(job?.sealedEmail).not.toContain(to);

    const tokenHash = accountSecretHash(start.challenge);

    const codeHash = createHmac('sha256', secret)
      .update(JSON.stringify(['code', tokenHash, 'register', '012345']))
      .digest('hex');

    const pending = await first.client.emailChallenge.update({
      where: { tokenHash },
      data: { codeHash },
    });

    await first.client.accountEmailJob.updateMany({
      where: { challengeHash: tokenHash },
      data: {
        codeHash,
        sealedEmail: cipher.seal({
          to,
          code: '012345',
          purpose: 'register',
          expiresAt: pending.expiresAt.toISOString(),
        }),
      },
    });

    const mail = await delivered(to);

    expect(mail.code).toBe('012345');

    const session = await native.confirm(start.challenge, mail.code, start.browser, randomUUID());

    expect((await accounts.readSession(accountSecretHash(session.token), now))?.user.email).toBe(
      to,
    );

    await expect(
      native.confirm(start.challenge, mail.code, start.browser, randomUUID()),
    ).rejects.toThrow('Could not confirm');

    expect(
      (
        await first.client.emailChallenge.findUnique({
          where: { tokenHash: accountSecretHash(start.challenge) },
        })
      )?.passwordHash,
    ).toBeNull();
  });

  it('binds codes to browser and purpose, counts incorrect attempts atomically and locks after five', async () => {
    const to = email();
    const start = await native.requestCode('register', { email: to, password }, randomUUID());
    const mail = await delivered(to);

    await expect(
      native.confirm(start.challenge, mail.code, 'A'.repeat(43), randomUUID()),
    ).rejects.toThrow();

    await expect(
      native.reset(start.challenge, mail.code, password, start.browser, randomUUID()),
    ).rejects.toThrow();

    const wrong = mail.code === '999999' ? '888888' : '999999';

    const result = await Promise.allSettled(
      Array.from({ length: 5 }, (_, index) =>
        (index % 2 ? other : native).confirm(start.challenge, wrong, start.browser, randomUUID()),
      ),
    );

    expect(result.every((item) => item.status === 'rejected')).toBe(true);

    expect(
      (
        await first.client.emailChallenge.findUnique({
          where: { tokenHash: accountSecretHash(start.challenge) },
        })
      )?.attempts,
    ).toBe(5);

    await expect(
      native.confirm(start.challenge, mail.code, start.browser, randomUUID()),
    ).rejects.toThrow();
  });

  it('resends supersede old codes and jobs without extending expiry or resetting attempts', async () => {
    const to = email();
    const start = await native.requestCode('register', { email: to, password }, randomUUID());
    const previous = await delivered(to);

    const before = await first.client.emailChallenge.findUniqueOrThrow({
      where: { tokenHash: accountSecretHash(start.challenge) },
    });

    await native.resend(start.challenge, start.browser, randomUUID());

    const next = await delivered(to);

    if (next.code !== previous.code) {
      await expect(
        native.confirm(start.challenge, previous.code, start.browser, randomUUID()),
      ).rejects.toThrow();
    }

    const after = await first.client.emailChallenge.findUniqueOrThrow({
      where: { tokenHash: accountSecretHash(start.challenge) },
    });

    expect(after.expiresAt).toEqual(before.expiresAt);
    expect(after.sends).toBe(2);

    expect(
      (await native.confirm(start.challenge, next.code, start.browser, randomUUID())).session.user
        .email,
    ).toBe(to);
  });

  it('expires requests and serializes concurrent confirmation across independent clients', async () => {
    const to = email();
    const start = await native.requestCode('register', { email: to, password }, randomUUID());
    const mail = await delivered(to);

    const outcomes = await Promise.allSettled(
      [native, other].map((service) =>
        service.confirm(start.challenge, mail.code, start.browser, randomUUID()),
      ),
    );

    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);

    const expiredTo = email();

    const expired = await native.requestCode(
      'register',
      { email: expiredTo, password },
      randomUUID(),
    );

    const expiredMail = await delivered(expiredTo);
    const actualNow = now;

    now = new Date(now.getTime() + 10 * 60_000);

    await expect(
      native.confirm(expired.challenge, expiredMail.code, expired.browser, randomUUID()),
    ).rejects.toThrow();

    now = actualNow;
  });

  it('resets only after proof, revokes every old session and rejects login using a hash checked before reset', async () => {
    const user = await registered();
    const previous = (await first.credential(user.to))!;
    const secondSession = await native.login({ email: user.to, password }, randomUUID());
    const reset = await native.requestCode('reset', { email: user.to }, randomUUID());
    const mail = await delivered(user.to);

    await native.reset(
      reset.challenge,
      mail.code,
      'another-synthetic-passphrase1!',
      reset.browser,
      randomUUID(),
    );

    expect(await accounts.readSession(accountSecretHash(user.session.token), now)).toBeNull();
    expect(await accounts.readSession(accountSecretHash(secondSession.token), now)).toBeNull();

    expect(
      await first.createPasswordSession(user.to, previous.passwordHash, user.session.session),
    ).toBeNull();

    await expect(native.login({ email: user.to, password }, randomUUID())).rejects.toThrow();

    expect(
      (
        await native.login(
          { email: user.to, password: 'another-synthetic-passphrase1!' },
          randomUUID(),
        )
      ).session.user.username,
    ).toBeNull();

    await expect(
      native.reset(reset.challenge, mail.code, password, reset.browser, randomUUID()),
    ).rejects.toThrow();
  });

  it('does not overwrite an existing password identity through re-registration or deliver unknown reset addresses', async () => {
    const user = await registered();
    const firstCredential = await first.credential(user.to);

    const duplicate = await native.requestCode(
      'register',
      { email: user.to, password: 'untrusted-new-passphrase1!' },
      randomUUID(),
    );

    const mail = await delivered(user.to);

    const wrongCode = String((Number(mail.code) + 1) % 1_000_000).padStart(6, '0');

    await expect(
      native.confirm(duplicate.challenge, wrongCode, duplicate.browser, randomUUID()),
    ).rejects.toMatchObject({ code: 'invalid_code' });

    await expect(
      native.confirm(duplicate.challenge, mail.code, duplicate.browser, randomUUID()),
    ).rejects.toMatchObject({ code: 'account_exists' });

    await expect(
      native.confirm(duplicate.challenge, mail.code, duplicate.browser, randomUUID()),
    ).rejects.toMatchObject({ code: 'invalid_code' });

    expect(await first.credential(user.to)).toEqual(firstCredential);

    expect((await native.login({ email: user.to, password }, randomUUID())).session.user.id).toBe(
      firstCredential?.userId,
    );

    await expect(
      native.login({ email: user.to, password: 'untrusted-new-passphrase1!' }, randomUUID()),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });

    const missing = await native.requestCode('reset', { email: email() }, randomUUID());

    expect(
      await first.client.accountEmailJob.count({
        where: { challengeHash: accountSecretHash(missing.challenge) },
      }),
    ).toBe(0);
  });

  it('shares persistent admission limits across clients and rejects disabled users', async () => {
    const key = randomUUID();

    const admissions = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        (index % 2 ? first : second).admit([{ key, maximum: 10 }], now),
      ),
    );

    expect(admissions.filter(Boolean)).toHaveLength(10);
    await first.client.credentialRateWindow.delete({ where: { key } });

    const user = await registered();

    await first.client.accountUser.update({
      where: { id: user.session.session.user.id },
      data: { state: 'disabled' },
    });

    await expect(native.login({ email: user.to, password }, randomUUID())).rejects.toThrow();
  });

  it('leases jobs once across workers, retries SMTP failures and clears terminal payloads', async () => {
    const to = email();
    const start = await native.requestCode('register', { email: to, password }, randomUUID());
    let sent = 0;

    const mailer = {
      send: async () => {
        sent++;
      },
    };

    const results = await Promise.all([
      new AccountEmailQueue(first.client, cipher, mailer, () => now).deliverOne(),
      new AccountEmailQueue(second.client, cipher, mailer, () => now).deliverOne(),
    ]);

    expect(results).toContain('sent');
    expect(sent).toBe(1);

    expect(
      (
        await first.client.accountEmailJob.findFirst({
          where: { challengeHash: accountSecretHash(start.challenge) },
        })
      )?.sealedEmail,
    ).toBeNull();

    const failing = await native.requestCode(
      'register',
      { email: email(), password },
      randomUUID(),
    );

    const failQueue = new AccountEmailQueue(
      first.client,
      cipher,
      {
        send: async () => {
          throw new Error('private SMTP failure');
        },
      },
      () => now,
    );

    expect(await failQueue.deliverOne()).toBe('retry');

    const originalNow = now;

    now = new Date(now.getTime() + 21_000);
    expect(await failQueue.deliverOne()).toBe('retry');
    now = new Date(now.getTime() + 41_000);
    expect(await failQueue.deliverOne()).toBe('failed');

    const row = await first.client.accountEmailJob.findFirst({
      where: { challengeHash: accountSecretHash(failing.challenge) },
    });

    expect(row?.state).toBe('failed');
    expect(row?.sealedEmail).toBeNull();
    now = originalNow;
  });

  it('recovers abandoned leases and never sends superseded or expired jobs', async () => {
    const to = email();
    const start = await native.requestCode('register', { email: to, password }, randomUUID());
    const tokenHash = accountSecretHash(start.challenge);

    const abandoned = await first.client.accountEmailJob.findFirstOrThrow({
      where: { challengeHash: tokenHash },
    });

    await first.client.accountEmailJob.update({
      where: { id: abandoned.id },
      data: {
        state: 'leased',
        leaseToken: randomUUID(),
        leaseUntil: new Date(now.getTime() - 1),
        attempts: 1,
      },
    });

    await delivered(to);

    expect(
      (await first.client.accountEmailJob.findUniqueOrThrow({ where: { id: abandoned.id } }))
        .attempts,
    ).toBe(2);

    const previous = await native.requestCode('register', { email: to, password }, randomUUID());

    const expired = await native.requestCode('register', { email: to, password }, randomUUID());

    const stale = await first.client.accountEmailJob.findFirstOrThrow({
      where: { challengeHash: accountSecretHash(previous.challenge) },
    });

    const expiredJob = await first.client.accountEmailJob.findFirstOrThrow({
      where: { challengeHash: accountSecretHash(expired.challenge) },
    });

    expect(stale.state).toBe('canceled');
    expect(stale.sealedEmail).toBeNull();

    const actualNow = now;
    const before = mailbox.length;

    now = new Date(now.getTime() + 10 * 60_000);

    try {
      await delivered(to);
      expect(mailbox).toHaveLength(before);

      expect(
        (await first.client.accountEmailJob.findUniqueOrThrow({ where: { id: expiredJob.id } }))
          .sealedEmail,
      ).toBeNull();
    } finally {
      now = actualNow;

      await first.client.accountEmailJob.deleteMany({
        where: { id: { in: [abandoned.id, stale.id, expiredJob.id] } },
      });
    }
  });

  it('keeps native and SSO identities separate even with the same verified email', async () => {
    const user = await registered();

    const sso = await accounts.createSession(
      { issuer: 'https://github.com', subject: randomUUID(), provider: 'github', email: user.to },
      { ...user.session.session, tokenHash: accountSecretHash(randomUUID()) },
    );

    try {
      expect(sso.user.id).not.toBe(user.session.session.user.id);

      const reset = await native.requestCode('reset', { email: user.to }, randomUUID());
      const mail = await delivered(user.to);

      await native.reset(
        reset.challenge,
        mail.code,
        'another-synthetic-passphrase1!',
        reset.browser,
        randomUUID(),
      );

      expect((await accounts.readSession(sso.tokenHash, now))?.user.id).toBe(sso.user.id);
    } finally {
      await first.client.applicationSession.deleteMany({ where: { userId: sso.user.id } });
      await first.client.accountIdentity.deleteMany({ where: { userId: sso.user.id } });
      await first.client.accountUser.delete({ where: { id: sso.user.id } });
    }
  });

  it('deletes native credentials, every session and pending mail without deleting an SSO account sharing the email', async () => {
    const user = await registered();
    const additional = await native.login({ email: user.to, password }, randomUUID());
    const reset = await native.requestCode('reset', { email: user.to }, randomUUID());

    const pendingRegistration = await native.requestCode(
      'register',
      { email: user.to, password },
      randomUUID(),
    );

    const challenges = await first.client.emailChallenge.findMany({ where: { email: user.to } });

    const sso = await accounts.createSession(
      { issuer: 'https://github.com', subject: randomUUID(), provider: 'github', email: user.to },
      { ...user.session.session, tokenHash: accountSecretHash(randomUUID()) },
    );

    try {
      // Deleting an SSO account cannot cancel the unrelated native account's recovery.
      expect(await accounts.deleteAccount(sso.user.id, sso.tokenHash, sso.csrfToken, now)).toBe(
        true,
      );

      expect(await first.credential(user.to)).not.toBeNull();

      expect(
        await first.readChallenge(
          accountSecretHash(reset.challenge),
          accountSecretHash(reset.browser),
          now,
        ),
      ).not.toBeNull();

      const replacementSso = await accounts.createSession(
        { issuer: 'https://github.com', subject: randomUUID(), provider: 'github', email: user.to },
        { ...user.session.session, tokenHash: accountSecretHash(randomUUID()) },
      );

      try {
        const passwordHash = (await first.credential(user.to))!.passwordHash;
        const racedSession = { ...additional.session, tokenHash: accountSecretHash(randomUUID()) };

        const loginRace = await Promise.all([
          accounts.deleteAccount(
            user.session.session.user.id,
            user.session.session.tokenHash,
            user.session.session.csrfToken,
            now,
          ),
          second.createPasswordSession(user.to, passwordHash, racedSession),
        ]);

        expect(loginRace[0]).toBe(true);
        expect(await accounts.readSession(additional.session.tokenHash, now)).toBeNull();
        expect(await accounts.readSession(racedSession.tokenHash, now)).toBeNull();
        expect(await first.credential(user.to)).toBeNull();

        expect(
          await first.client.accountUser.findUnique({
            where: { id: user.session.session.user.id },
          }),
        ).toBeNull();

        expect(await first.client.emailChallenge.count({ where: { email: user.to } })).toBe(0);

        expect(
          await first.client.accountEmailJob.count({
            where: { challengeHash: { in: challenges.map((challenge) => challenge.tokenHash) } },
          }),
        ).toBe(0);

        expect(await accounts.readSession(replacementSso.tokenHash, now)).not.toBeNull();

        expect(
          await first.readChallenge(
            accountSecretHash(pendingRegistration.challenge),
            accountSecretHash(pendingRegistration.browser),
            now,
          ),
        ).toBeNull();

        await expect(native.login({ email: user.to, password }, randomUUID())).rejects.toThrow(
          'Email or password',
        );

        const replacement = await registered(user.to);

        expect(replacement.session.session.user.id).not.toBe(user.session.session.user.id);
      } finally {
        await accounts.deleteAccount(
          replacementSso.user.id,
          replacementSso.tokenHash,
          replacementSso.csrfToken,
          now,
        );
      }
    } finally {
      await accounts.deleteAccount(sso.user.id, sso.tokenHash, sso.csrfToken, now);
    }
  });

  it('exposes guarded registration/confirmation/login/reset API without leaking passwords, codes or hashes', async () => {
    const repository = new MemoryJobRepository();
    const origin = 'https://example.invalid';
    const testIp = '2001:db8::' + randomUUID().slice(0, 4) + ':' + randomUUID().slice(0, 4);

    const app = await createApp({
      repository,
      catalog: new JobCatalog(repository, [], [], 'demo'),
      origin,
      accounts: new Accounts(accounts, []),
      passwordAccounts: native,
    });

    try {
      const to = email();

      expect(
        (
          await app.inject({
            remoteAddress: testIp,
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: { email: to, password },
          })
        ).statusCode,
      ).toBe(403);

      expect(
        (
          await app.inject({
            remoteAddress: testIp,
            method: 'POST',
            url: '/api/v1/auth/register',
            headers: { origin },
            payload: { email: to, password, admin: true },
          })
        ).statusCode,
      ).toBe(400);

      const obsoleteUsername = await app.inject({
        remoteAddress: testIp,
        method: 'POST',
        url: '/api/v1/auth/register',
        headers: { origin },
        payload: { email: email(), password, username: 'synthetic_user' },
      });

      expect(obsoleteUsername.statusCode).toBe(400);

      for (const invalidPassword of ['Abcde1!', 'Abcdefgh!', 'Abcdefg1']) {
        const invalid = await app.inject({
          remoteAddress: testIp,
          method: 'POST',
          url: '/api/v1/auth/register',
          headers: { origin },
          payload: { email: email(), password: invalidPassword },
        });

        expect(invalid.statusCode).toBe(400);
        expect(invalid.json().message).toContain('Password is not valid');
      }

      const started = await app.inject({
        remoteAddress: testIp,
        method: 'POST',
        url: '/api/v1/auth/register',
        headers: { origin },
        payload: { email: to, password },
      });

      expect(started.statusCode).toBe(200);
      expect(started.headers['cache-control']).toBe('no-store');
      expect(started.cookies[0]?.httpOnly).toBe(true);
      expect(started.cookies[0]?.secure).toBe(true);

      const mail = await delivered(to);

      expect(started.body).not.toContain(mail.code);
      expect(started.body).not.toContain(password);

      const browser = `${started.cookies[0]!.name}=${started.cookies[0]!.value}`;

      const confirm = await app.inject({
        remoteAddress: testIp,
        method: 'POST',
        url: '/api/v1/auth/register/confirm',
        headers: { origin, cookie: browser },
        payload: { challenge: started.json().challenge, code: mail.code },
      });

      expect(confirm.statusCode).toBe(200);
      expect(confirm.json()).toEqual({ signedIn: true });

      const sessionCookie = `${confirm.cookies[0]!.name}=${confirm.cookies[0]!.value}`;

      const account = await app.inject({
        remoteAddress: testIp,
        url: '/api/v1/account',
        headers: { cookie: sessionCookie },
      });

      expect(account.json().user.email).toBe(to);
      expect(account.body).not.toContain('passwordHash');

      const login = await app.inject({
        remoteAddress: testIp,
        method: 'POST',
        url: '/api/v1/auth/password/login',
        headers: { origin },
        payload: { email: to, password },
      });

      expect(login.statusCode).toBe(200);
      expect(login.cookies[0]?.value).not.toBe(confirm.cookies[0]?.value);

      const duplicate = await app.inject({
        remoteAddress: testIp,
        method: 'POST',
        url: '/api/v1/auth/register',
        headers: { origin },
        payload: { email: to, password: 'different-synthetic-password1!' },
      });

      expect(duplicate.statusCode).toBe(200);
      expect(duplicate.json().message).not.toContain('already verified');

      const duplicateMail = await delivered(to);
      const duplicateBrowser = `${duplicate.cookies[0]!.name}=${duplicate.cookies[0]!.value}`;

      const duplicateResult = await app.inject({
        remoteAddress: testIp,
        method: 'POST',
        url: '/api/v1/auth/register/confirm',
        headers: { origin, cookie: duplicateBrowser },
        payload: { challenge: duplicate.json().challenge, code: duplicateMail.code },
      });

      expect(duplicateResult.statusCode).toBe(400);
      expect(duplicateResult.json().code).toBe('account_exists');
      expect(duplicateResult.json().message).toContain('already verified');
      expect(duplicateResult.cookies).toHaveLength(0);
      expect(duplicateResult.body).not.toContain(duplicateMail.code);

      expect(
        (await app.inject({ url: '/api/v1/account', headers: { cookie: sessionCookie } })).json()
          .user.email,
      ).toBe(to);

      const reset = await app.inject({
        remoteAddress: testIp,
        method: 'POST',
        url: '/api/v1/auth/password/reset',
        headers: { origin },
        payload: { email: to },
      });

      const resetMail = await delivered(to);

      const complete = await app.inject({
        remoteAddress: testIp,
        method: 'POST',
        url: '/api/v1/auth/password/reset/confirm',
        headers: { origin, cookie: `${reset.cookies[0]!.name}=${reset.cookies[0]!.value}` },
        payload: {
          challenge: reset.json().challenge,
          code: resetMail.code,
          password: 'new-synthetic-passphrase1!',
        },
      });

      expect(complete.statusCode).toBe(200);

      expect(
        (
          await app.inject({
            remoteAddress: testIp,
            url: '/api/v1/account',
            headers: { cookie: sessionCookie },
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await app.close();
    }
  });
});
