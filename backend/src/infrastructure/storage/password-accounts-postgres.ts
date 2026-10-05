import { randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { PasswordAccountRepository } from '../../ports/password-accounts.js';
import type { AccountSession } from '../../domain/accounts/identity.js';
import type {
  EmailChallenge,
  EmailCodePurpose,
  NewAccountSession,
} from '../../domain/accounts/password.js';
import { emailCodeSends, usableEmailChallenge } from '../../domain/accounts/password.js';

type Transaction = Prisma.TransactionClient;

type ChallengeRow = Omit<EmailChallenge, 'expiresAt' | 'createdAt' | 'consumedAt'> & {
  expiresAt: Date;
  createdAt: Date;
  consumedAt: Date | null;
};

function challengeRecord(row: ChallengeRow): EmailChallenge {
  return {
    ...row,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    consumedAt: row.consumedAt?.toISOString() ?? null,
  };
}

/** Account-specific durable queue. Challenge changes and queue writes share a transaction. */
export class PostgresPasswordAccounts implements PasswordAccountRepository {
  readonly client: PrismaClient;

  constructor(connectionString: string) {
    this.client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  private async lockEmail(tx: Transaction, email: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 2714))`;
  }

  async admit(buckets: { key: string; maximum: number }[], now: Date) {
    return this.client.$transaction(async (tx) => {
      await tx.credentialRateWindow.deleteMany({ where: { expiresAt: { lte: now } } });

      let allowed = true;

      for (const bucket of [...buckets].sort((a, b) => a.key.localeCompare(b.key))) {
        const row = await tx.credentialRateWindow.upsert({
          where: { key: bucket.key },
          update: { count: { increment: 1 } },
          create: { key: bucket.key, count: 1, expiresAt: new Date(now.getTime() + 15 * 60_000) },
        });

        allowed = row.count <= bucket.maximum && allowed;
      }

      return allowed;
    });
  }

  private async enqueue(
    tx: Transaction,
    challenge: { tokenHash: string; codeHash: string; expiresAt: string },
    sealedEmail: string,
    now: Date,
  ) {
    await tx.accountEmailJob.create({
      data: {
        id: randomUUID(),
        challengeHash: challenge.tokenHash,
        codeHash: challenge.codeHash,
        sealedEmail,
        availableAt: now,
        expiresAt: new Date(challenge.expiresAt),
      },
    });
  }

  async createChallenge(challenge: EmailChallenge, sealedEmail: string, now: Date) {
    await this.client.$transaction(async (tx) => {
      await this.lockEmail(tx, challenge.email);

      await tx.accountEmailJob.updateMany({
        where: { expiresAt: { lte: now } },
        data: { state: 'canceled', sealedEmail: null },
      });

      await tx.emailChallenge.deleteMany({ where: { expiresAt: { lte: now } } });

      const old = await tx.emailChallenge.findMany({
        where: { email: challenge.email, purpose: challenge.purpose, consumedAt: null },
        select: { tokenHash: true },
      });

      await tx.accountEmailJob.updateMany({
        where: { challengeHash: { in: old.map((row) => row.tokenHash) } },
        data: { state: 'canceled', sealedEmail: null },
      });

      await tx.emailChallenge.updateMany({
        where: { tokenHash: { in: old.map((row) => row.tokenHash) } },
        data: { consumedAt: now, passwordHash: null, username: null },
      });

      await tx.emailChallenge.create({
        data: {
          ...challenge,
          createdAt: new Date(challenge.createdAt),
          expiresAt: new Date(challenge.expiresAt),
          consumedAt: null,
        },
      });

      // Unknown reset addresses get the same challenge response, without sending unsolicited mail.
      if (
        challenge.purpose === 'register' ||
        (await tx.passwordCredential.findUnique({ where: { email: challenge.email } }))
      ) {
        await this.enqueue(tx, challenge, sealedEmail, now);
      }
    });
  }

  async readChallenge(tokenHash: string, browserHash: string, now: Date) {
    const row = await this.client.emailChallenge.findUnique({ where: { tokenHash } });

    if (
      !row ||
      row.browserHash !== browserHash ||
      !usableEmailChallenge(challengeRecord(row as ChallengeRow), now)
    ) {
      return null;
    }

    return challengeRecord(row as ChallengeRow);
  }

  private async lockedChallenge(
    tx: Transaction,
    tokenHash: string,
    browserHash: string,
    now: Date,
  ) {
    const candidate = await tx.emailChallenge.findUnique({ where: { tokenHash } });

    if (!candidate || candidate.browserHash !== browserHash) {
      return null;
    }

    await this.lockEmail(tx, candidate.email);

    const [row] = await tx.$queryRaw<
      ChallengeRow[]
    >`SELECT * FROM "EmailChallenge" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;

    if (!row || !usableEmailChallenge(challengeRecord(row), now)) {
      return null;
    }

    return challengeRecord(row);
  }

  async resendChallenge(
    tokenHash: string,
    browserHash: string,
    codeHash: string,
    sealedEmail: string,
    now: Date,
  ) {
    return this.client.$transaction(async (tx) => {
      const row = await this.lockedChallenge(tx, tokenHash, browserHash, now);

      if (!row || row.sends >= emailCodeSends) {
        return false;
      }

      await tx.accountEmailJob.updateMany({
        where: { challengeHash: tokenHash },
        data: { state: 'canceled', sealedEmail: null },
      });

      await tx.emailChallenge.update({
        where: { tokenHash },
        data: { codeHash, sends: { increment: 1 } },
      });

      if (
        row.purpose === 'register' ||
        (await tx.passwordCredential.findUnique({ where: { email: row.email } }))
      ) {
        await this.enqueue(tx, { ...row, codeHash }, sealedEmail, now);
      }

      return true;
    });
  }

  private async checked(
    tx: Transaction,
    tokenHash: string,
    browserHash: string,
    codeHash: string,
    purpose: EmailCodePurpose,
    now: Date,
  ) {
    const row = await this.lockedChallenge(tx, tokenHash, browserHash, now);

    if (!row || row.purpose !== purpose) {
      return null;
    }

    await tx.emailChallenge.update({ where: { tokenHash }, data: { attempts: { increment: 1 } } });

    if (!timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(codeHash))) {
      return null;
    }

    await tx.emailChallenge.update({
      where: { tokenHash },
      data: { consumedAt: now, passwordHash: null, username: null },
    });

    await tx.accountEmailJob.updateMany({
      where: { challengeHash: tokenHash },
      data: { state: 'canceled', sealedEmail: null },
    });

    return row;
  }

  private async session(tx: Transaction, user: AccountSession['user'], input: NewAccountSession) {
    const [current] = await tx.$queryRaw<
      AccountSession['user'][]
    >`SELECT "id", "state", "email", "username" FROM "AccountUser" WHERE "id" = ${user.id} FOR UPDATE`;

    if (!current || current.state !== 'active') {
      return null;
    }

    await tx.applicationSession.create({
      data: {
        tokenHash: input.tokenHash,
        csrfToken: input.csrfToken,
        userId: user.id,
        idleExpiresAt: new Date(input.idleExpiresAt),
        absoluteExpiresAt: new Date(input.absoluteExpiresAt),
      },
    });

    return { ...input, user: current };
  }

  async confirmRegistration(
    tokenHash: string,
    browserHash: string,
    codeHash: string,
    session: NewAccountSession,
    now: Date,
  ) {
    return this.client.$transaction(async (tx) => {
      const row = await this.checked(tx, tokenHash, browserHash, codeHash, 'register', now);

      if (
        !row ||
        !row.passwordHash ||
        (await tx.passwordCredential.findUnique({ where: { email: row.email } }))
      ) {
        return null;
      }

      // Never link to an SSO user by matching email alone.
      const user = await tx.accountUser.create({
        data: { email: row.email, username: row.username },
      });

      await tx.passwordCredential.create({
        data: {
          email: row.email,
          userId: user.id,
          passwordHash: row.passwordHash,
          verifiedAt: now,
        },
      });

      return this.session(
        tx,
        { id: user.id, email: user.email, username: user.username, state: 'active' },
        session,
      );
    });
  }

  async resetPassword(
    tokenHash: string,
    browserHash: string,
    codeHash: string,
    passwordHash: string,
    now: Date,
  ) {
    return this.client.$transaction(async (tx) => {
      const row = await this.checked(tx, tokenHash, browserHash, codeHash, 'reset', now);

      if (!row) {
        return false;
      }

      const credential = await tx.passwordCredential.findUnique({
        where: { email: row.email },
        include: { user: true },
      });

      if (!credential || credential.user.state !== 'active') {
        return false;
      }

      await tx.passwordCredential.update({ where: { email: row.email }, data: { passwordHash } });

      await tx.applicationSession.updateMany({
        where: { userId: credential.userId, revokedAt: null },
        data: { revokedAt: now },
      });

      // Invalidate other outstanding reset codes for this address as well.
      await tx.emailChallenge.updateMany({
        where: { email: row.email, purpose: 'reset', consumedAt: null },
        data: { consumedAt: now, passwordHash: null },
      });

      return true;
    });
  }

  async credential(email: string) {
    const row = await this.client.passwordCredential.findUnique({
      where: { email },
      include: { user: true },
    });

    return row ? { passwordHash: row.passwordHash, state: row.user.state } : null;
  }

  async createPasswordSession(email: string, expectedHash: string, session: NewAccountSession) {
    return this.client.$transaction(async (tx) => {
      await this.lockEmail(tx, email);

      const row = await tx.passwordCredential.findUnique({
        where: { email },
        include: { user: true },
      });

      if (!row || row.passwordHash !== expectedHash || row.user.state !== 'active') {
        return null;
      }

      return this.session(
        tx,
        { id: row.user.id, email: row.email, username: row.user.username, state: 'active' },
        session,
      );
    });
  }

  async close() {
    await this.client.$disconnect();
  }
}
