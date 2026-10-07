import { htmlJobDocumentReader } from './infrastructure/job-document.js';
import 'dotenv/config';
import { z } from 'zod';
import { JobCatalog } from './application/catalog.js';
import { AnalyzeResume } from './application/resume/analyze-resume.js';
import { MatchJobs } from './application/resume/match-jobs.js';
import { BackfillJobFeatures } from './application/resume/job-features.js';
import { MemoryJobFeatures } from './infrastructure/storage/feature-memory.js';
import { PostgresJobFeatures } from './infrastructure/storage/feature-postgres.js';
import { SyncSource } from './application/sync-source.js';
import { LabelMappingStrategy, TitleRuleStrategy } from './domain/classification.js';
import { loadRegistry } from './infrastructure/registry.js';
import { PublicJsonTransport } from './infrastructure/http.js';
import { htmlPreparation } from './infrastructure/html.js';
import { createAdapters } from './infrastructure/adapters/factory.js';
import { MemoryJobRepository } from './infrastructure/storage/memory.js';
import { PostgresJobRepository } from './infrastructure/storage/postgres.js';
import { seedDemo } from './infrastructure/demo.js';
import { AuditedPostingValidation } from './infrastructure/audits/validation.js';
import { Accounts } from './application/accounts/accounts.js';
import { PostgresAccounts } from './infrastructure/storage/accounts-postgres.js';
import { OAuthIdentityProvider } from './infrastructure/accounts/oauth.js';
import { PasswordAccounts } from './application/accounts/password-accounts.js';
import { PostgresPasswordAccounts } from './infrastructure/storage/password-accounts-postgres.js';
import { ScryptPasswords } from './infrastructure/accounts/password-hasher.js';
import { renderAccountEmail } from './infrastructure/accounts/account-email-template.js';
import { EncryptedAccountEmail } from './infrastructure/accounts/email-cipher.js';
import { RefreshWaves } from './application/refresh-waves.js';
import { FileWaveAudits, FileWaveRefreshReports } from './infrastructure/audits/wave-refresh.js';
import { PostgresCoverage } from './infrastructure/storage/coverage-postgres.js';
import { loadAuditPlans } from './infrastructure/audits/registry.js';
import { configurationHash } from './infrastructure/audits/model.js';

export const config = z
  .object({
    DATA_MODE: z.enum(['demo', 'postgres']).default('demo'),
    DATABASE_URL: z.string().optional(),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    HOST: z.string().default('127.0.0.1'),
    FRONTEND_ORIGIN: z.url().default('http://127.0.0.1:5173'),
    INGESTION_WAVE_SYNC: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    MATCH_CURSOR_SECRET: z.string().min(32).optional(),
    GITHUB_CLIENT_ID: z.string().min(1).optional(),
    GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
    LINKEDIN_CLIENT_ID: z.string().min(1).optional(),
    LINKEDIN_CLIENT_SECRET: z.string().min(1).optional(),
    AUTH_CODE_SECRET: z.string().min(32).optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_FROM: z.email().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_ALLOW_INSECURE_LOCAL: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    for (const provider of ['GITHUB', 'LINKEDIN'] as const) {
      if (!!value[`${provider}_CLIENT_ID`] !== !!value[`${provider}_CLIENT_SECRET`]) {
        context.addIssue({
          code: 'custom',
          message: `${provider} requires both client ID and secret.`,
        });
      }
    }

    if (!!value.SMTP_USER !== !!value.SMTP_PASSWORD) {
      context.addIssue({ code: 'custom', message: 'SMTP requires both username and password.' });
    }

    if (
      value.SMTP_ALLOW_INSECURE_LOCAL &&
      !['127.0.0.1', 'localhost', '::1'].includes(value.SMTP_HOST ?? '')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Plain SMTP is restricted to loopback development.',
      });
    }

    if (value.GITHUB_CLIENT_ID || value.LINKEDIN_CLIENT_ID || value.AUTH_CODE_SECRET) {
      const origin = new URL(value.FRONTEND_ORIGIN);

      if (
        value.DATA_MODE !== 'postgres' ||
        origin.origin !== value.FRONTEND_ORIGIN ||
        (origin.protocol !== 'https:' &&
          !(
            origin.protocol === 'http:' &&
            ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)
          ))
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Sign-in requires PostgreSQL and an HTTPS origin (HTTP loopback is allowed locally).',
        });
      }
    }
  })
  .parse(process.env);

export async function bootstrap() {
  const { companies, sources } = loadRegistry();

  if (config.DATA_MODE === 'postgres' && !config.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in postgres mode');
  }

  const repository =
    config.DATA_MODE === 'postgres'
      ? new PostgresJobRepository(config.DATABASE_URL!)
      : new MemoryJobRepository();

  await repository.ping();

  if (config.DATA_MODE === 'demo') {
    await seedDemo(repository, sources);
  }

  const http = new PublicJsonTransport();

  const features =
    config.DATA_MODE === 'postgres'
      ? new PostgresJobFeatures(config.DATABASE_URL!)
      : new MemoryJobFeatures(() => repository.read());

  const adapters = createAdapters(http);

  const coverage =
    config.DATA_MODE === 'postgres'
      ? new PostgresCoverage(
          config.DATABASE_URL!,
          new Map(
            loadAuditPlans().map((plan) => [
              plan.companySlug,
              configurationHash(
                plan,
                sources.filter((source) => source.companySlug === plan.companySlug),
              ),
            ]),
          ),
        )
      : undefined;

  const accountRepository =
    config.DATA_MODE === 'postgres' ? new PostgresAccounts(config.DATABASE_URL!) : undefined;

  const providers = [
    ...(config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET
      ? [
          new OAuthIdentityProvider('github', {
            clientId: config.GITHUB_CLIENT_ID,
            clientSecret: config.GITHUB_CLIENT_SECRET,
            callbackUrl: `${config.FRONTEND_ORIGIN}/api/v1/auth/github/callback`,
          }),
        ]
      : []),
    ...(config.LINKEDIN_CLIENT_ID && config.LINKEDIN_CLIENT_SECRET
      ? [
          new OAuthIdentityProvider('linkedin', {
            clientId: config.LINKEDIN_CLIENT_ID,
            clientSecret: config.LINKEDIN_CLIENT_SECRET,
            callbackUrl: `${config.FRONTEND_ORIGIN}/api/v1/auth/linkedin/callback`,
          }),
        ]
      : []),
  ];

  const passwordRepository =
    config.DATA_MODE === 'postgres' && config.AUTH_CODE_SECRET
      ? new PostgresPasswordAccounts(config.DATABASE_URL!)
      : undefined;

  const sync = new SyncSource(
    repository,
    adapters,
    htmlPreparation,
    [new LabelMappingStrategy(), new TitleRuleStrategy()],
    undefined,
    new AuditedPostingValidation(companies, sources, adapters),
  );

  const backfill = new BackfillJobFeatures(features, htmlJobDocumentReader);

  return {
    companies,
    sources,
    renderAccountEmail,
    repository,
    adapters,
    ...(accountRepository ? { accounts: new Accounts(accountRepository, providers) } : {}),
    ...(passwordRepository && config.AUTH_CODE_SECRET
      ? {
          passwordAccounts: new PasswordAccounts(
            passwordRepository,
            new ScryptPasswords(),
            new EncryptedAccountEmail(config.AUTH_CODE_SECRET),
            config.AUTH_CODE_SECRET,
          ),
        }
      : {}),
    closeAccounts: async () => {
      await accountRepository?.close();
      await passwordRepository?.close();
    },
    catalog: new JobCatalog(repository, companies, sources, config.DATA_MODE, undefined, coverage),
    resume: new AnalyzeResume(companies),
    matcher: new MatchJobs(
      features,
      companies,
      sources,
      config.DATA_MODE,
      undefined,
      config.MATCH_CURSOR_SECRET,
      htmlJobDocumentReader,
    ),
    backfill,
    refreshWaves: new RefreshWaves(
      companies,
      sources,
      sync,
      new FileWaveAudits(adapters, coverage),
      new FileWaveRefreshReports(),
      backfill,
    ),
    closeFeatures: async () => {
      await coverage?.close();

      if (features instanceof PostgresJobFeatures) {
        await features.close();
      }
    },
    sync,
  };
}
