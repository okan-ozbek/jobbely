import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import type { AccountRepository } from '../../ports/accounts.js';
import type {
  AccountSession,
  AccountUser,
  SignInAttempt,
  SignInProvider,
  VerifiedIdentity,
} from '../../domain/accounts/identity.js';
import { AccountAccessError } from '../../domain/accounts/access.js';
import { accountDeletionSignInMs } from '../../domain/accounts/identity.js';

interface SessionRow {
  tokenHash: string;
  csrfToken: string;
  userId: string;
  state: AccountUser['state'];
  email: string | null;
  username: string | null;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}

function sessionRecord(row: SessionRow): AccountSession {
  return {
    tokenHash: row.tokenHash,
    csrfToken: row.csrfToken,
    user: { id: row.userId, state: row.state, email: row.email, username: row.username },
    idleExpiresAt: row.idleExpiresAt.toISOString(),
    absoluteExpiresAt: row.absoluteExpiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

export class PostgresAccounts implements AccountRepository {
  private readonly client: PrismaClient;

  constructor(connectionString: string) {
    this.client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  async saveAttempt(attempt: SignInAttempt, now: Date) {
    await this.client.$transaction(async (transaction) => {
      await transaction.oAuthAttempt.deleteMany({ where: { expiresAt: { lte: now } } });

      await transaction.oAuthAttempt.create({
        data: { ...attempt, expiresAt: new Date(attempt.expiresAt) },
      });
    });
  }

  async consumeAttempt(
    stateHash: string,
    browserHash: string,
    provider: SignInProvider,
    now: Date,
  ) {
    const [row] = await this.client.$queryRaw<
      (Omit<SignInAttempt, 'expiresAt'> & { expiresAt: Date })[]
    >`
      DELETE FROM "OAuthAttempt" WHERE "stateHash" = ${stateHash} AND "browserHash" = ${browserHash}
      AND "provider" = ${provider} AND "expiresAt" > ${now} RETURNING *`;

    return row ? { ...row, expiresAt: row.expiresAt.toISOString() } : null;
  }

  async createSession(identity: VerifiedIdentity, session: Omit<AccountSession, 'user'>) {
    return this.client.$transaction(async (transaction) => {
      // Serializes first registration as well as concurrent returning logins across instances.
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([identity.issuer, identity.subject])}, 2713))`;

      let linked = await transaction.accountIdentity.findUnique({
        where: { issuer_subject: { issuer: identity.issuer, subject: identity.subject } },
      });

      if (!linked) {
        const user = await transaction.accountUser.create({ data: { email: identity.email } });

        linked = await transaction.accountIdentity.create({
          data: {
            issuer: identity.issuer,
            subject: identity.subject,
            provider: identity.provider,
            userId: user.id,
          },
        });
      }

      const [user] = await transaction.$queryRaw<
        AccountUser[]
      >`SELECT "id", "state", "email" FROM "AccountUser" WHERE "id" = ${linked.userId} FOR UPDATE`;

      if (!user || user.state !== 'active') {
        throw new AccountAccessError('authentication_required', 'Sign in to an active account.');
      }

      await transaction.accountUser.update({
        where: { id: user.id },
        data: { email: identity.email },
      });

      await transaction.applicationSession.create({
        data: {
          tokenHash: session.tokenHash,
          csrfToken: session.csrfToken,
          userId: user.id,
          idleExpiresAt: new Date(session.idleExpiresAt),
          absoluteExpiresAt: new Date(session.absoluteExpiresAt),
        },
      });

      return { ...session, user: { ...user, email: identity.email } };
    });
  }

  async readSession(tokenHash: string, now: Date) {
    const [row] = await this.client.$queryRaw<SessionRow[]>`
      UPDATE "ApplicationSession" s SET "idleExpiresAt" = LEAST(s."absoluteExpiresAt", ${now}::timestamp + INTERVAL '7 days')
      FROM "AccountUser" u WHERE s."userId" = u."id" AND s."tokenHash" = ${tokenHash}
      AND s."revokedAt" IS NULL AND s."idleExpiresAt" > ${now} AND s."absoluteExpiresAt" > ${now} AND u."state" = 'active'
      RETURNING s.*, u."state", u."email", u."username"`;

    return row ? sessionRecord(row) : null;
  }

  async revokeSession(tokenHash: string, now: Date) {
    await this.client.applicationSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async close() {
    await this.client.$disconnect();
  }

  async deleteAccount(userId: string, tokenHash: string, csrfToken: string, now: Date) {
    return this.client.$transaction(async (transaction) => {
      const credential = await transaction.passwordCredential.findUnique({ where: { userId } });
      const identities = await transaction.accountIdentity.findMany({ where: { userId } });

      // Follow sign-in's lock order: credential/identity locks, user, then sessions.
      if (credential) {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${credential.email}, 2714))`;
      }

      for (const identity of identities.sort((a, b) =>
        JSON.stringify([a.issuer, a.subject]).localeCompare(JSON.stringify([b.issuer, b.subject])),
      )) {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([identity.issuer, identity.subject])}, 2713))`;
      }

      const [user] = await transaction.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "AccountUser" WHERE "id" = ${userId} AND "state" = 'active' FOR UPDATE`;

      if (!user) {
        return false;
      }

      const [session] = await transaction.$queryRaw<{ tokenHash: string; createdAt: Date }[]>`
        SELECT "tokenHash", "createdAt" FROM "ApplicationSession" WHERE "tokenHash" = ${tokenHash}
        AND "userId" = ${userId} AND "csrfToken" = ${csrfToken} AND "revokedAt" IS NULL
        AND "idleExpiresAt" > ${now} AND "absoluteExpiresAt" > ${now} FOR UPDATE`;

      if (!session) {
        return false;
      }

      if (session.createdAt.getTime() <= now.getTime() - accountDeletionSignInMs) {
        throw new AccountAccessError(
          'authentication_required',
          'Sign out and sign in again before deleting your account.',
        );
      }

      // Only native credentials own email challenges; matching SSO emails never imply ownership.
      if (credential) {
        const challenges = await transaction.emailChallenge.findMany({
          where: { OR: [{ email: credential.email }, { userId }] },
          select: { tokenHash: true },
        });

        await transaction.accountEmailJob.deleteMany({
          where: { challengeHash: { in: challenges.map((challenge) => challenge.tokenHash) } },
        });

        await transaction.emailChallenge.deleteMany({
          where: { OR: [{ email: credential.email }, { userId }] },
        });

        await transaction.passwordCredential.deleteMany({ where: { userId } });
      }

      await transaction.applicationSession.deleteMany({ where: { userId } });
      await transaction.accountIdentity.deleteMany({ where: { userId } });
      await transaction.accountUser.delete({ where: { id: userId } });

      return true;
    });
  }
}
