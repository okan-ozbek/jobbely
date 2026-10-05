import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { EncryptedAccountEmail } from './email-cipher.js';
import type { AccountEmail } from '../../ports/password-accounts.js';

export interface AccountMailer {
  send(message: AccountEmail): Promise<void>;
}

interface LeasedEmail {
  id: string;
  sealedEmail: string;
  attempts: number;
  leaseToken: string;
}

export class AccountEmailQueue {
  constructor(
    private readonly client: PrismaClient,
    private readonly cipher: EncryptedAccountEmail,
    private readonly mailer: AccountMailer,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async deliverOne(): Promise<'idle' | 'sent' | 'retry' | 'failed'> {
    const now = this.clock();

    await this.client.accountEmailJob.updateMany({
      where: { expiresAt: { lte: now }, sealedEmail: { not: null } },
      data: { sealedEmail: null, state: 'canceled' },
    });

    await this.client.emailChallenge.deleteMany({ where: { expiresAt: { lte: now } } });

    await this.client.accountEmailJob.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
    });

    const lease = randomUUID();

    const [job] = await this.client.$queryRaw<LeasedEmail[]>`
      UPDATE "AccountEmailJob" j SET "state" = 'leased', "leaseToken" = ${lease},
        "leaseUntil" = ${new Date(now.getTime() + 60_000)}, "attempts" = j."attempts" + 1
      FROM (SELECT j2."id" FROM "AccountEmailJob" j2 JOIN "EmailChallenge" c ON c."tokenHash" = j2."challengeHash"
        WHERE j2."sealedEmail" IS NOT NULL AND j2."expiresAt" > ${now} AND j2."attempts" < 3
        AND c."consumedAt" IS NULL AND c."attempts" < 5 AND c."codeHash" = j2."codeHash"
        AND ((j2."state" = 'queued' AND j2."availableAt" <= ${now}) OR (j2."state" = 'leased' AND j2."leaseUntil" <= ${now}))
        ORDER BY j2."availableAt" FOR UPDATE OF j2 SKIP LOCKED LIMIT 1) available
      WHERE j."id" = available."id" RETURNING j.*`;

    if (!job) {
      return 'idle';
    }

    try {
      const message = this.cipher.open(job.sealedEmail);

      if (Date.parse(message.expiresAt) <= this.clock().getTime()) {
        throw new Error('Expired email');
      }

      await this.mailer.send(message);

      await this.client.accountEmailJob.updateMany({
        where: { id: job.id, leaseToken: lease, state: 'leased' },
        data: { state: 'sent', sealedEmail: null, leaseToken: null, leaseUntil: null },
      });

      return 'sent';
    } catch {
      const failed =
        job.attempts >= 3 ||
        Date.parse(this.cipherExpiry(job.sealedEmail)) <= this.clock().getTime();

      await this.client.accountEmailJob.updateMany({
        where: { id: job.id, leaseToken: lease, state: 'leased' },
        data: {
          state: failed ? 'failed' : 'queued',
          ...(failed ? { sealedEmail: null } : {}),
          availableAt: new Date(this.clock().getTime() + 20_000 * 2 ** (job.attempts - 1)),
          leaseToken: null,
          leaseUntil: null,
        },
      });

      return failed ? 'failed' : 'retry';
    }
  }

  private cipherExpiry(sealed: string) {
    try {
      return this.cipher.open(sealed).expiresAt;
    } catch {
      return '1970-01-01T00:00:00.000Z';
    }
  }
}
