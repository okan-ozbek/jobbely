import { config } from '../bootstrap.js';
import { PostgresPasswordAccounts } from '../infrastructure/storage/password-accounts-postgres.js';
import { EncryptedAccountEmail } from '../infrastructure/accounts/email-cipher.js';
import { AccountEmailQueue } from '../infrastructure/accounts/account-email-queue.js';
import { SmtpAccountMailer } from '../infrastructure/accounts/smtp.js';

if (
  config.DATA_MODE !== 'postgres' ||
  !config.DATABASE_URL ||
  !config.AUTH_CODE_SECRET ||
  !config.SMTP_HOST ||
  !config.SMTP_FROM
) {
  throw new Error('Email worker requires PostgreSQL, AUTH_CODE_SECRET, SMTP_HOST and SMTP_FROM');
}

const repository = new PostgresPasswordAccounts(config.DATABASE_URL);

const mailer = new SmtpAccountMailer(config.SMTP_FROM, {
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_SECURE,
  allowInsecureLocal: config.SMTP_ALLOW_INSECURE_LOCAL,
  ...(config.SMTP_USER && config.SMTP_PASSWORD
    ? { username: config.SMTP_USER, password: config.SMTP_PASSWORD }
    : {}),
});

const queue = new AccountEmailQueue(
  repository.client,
  new EncryptedAccountEmail(config.AUTH_CODE_SECRET),
  mailer,
);

let stopping = false;

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    stopping = true;
  });
}

console.log('Account email worker ready.');

try {
  while (!stopping) {
    try {
      const result = await queue.deliverOne();

      if (result === 'retry' || result === 'failed') {
        console.warn(`Account email delivery: ${result}.`);
      }

      if (result !== 'idle') {
        continue;
      }
    } catch {
      console.warn('Account email queue unavailable; retrying.');
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
} finally {
  mailer.close();
  await repository.close();
}
