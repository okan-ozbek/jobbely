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

export const config = z
  .object({
    DATA_MODE: z.enum(['demo', 'postgres']).default('demo'),
    DATABASE_URL: z.string().optional(),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    HOST: z.string().default('127.0.0.1'),
    FRONTEND_ORIGIN: z.url().default('http://127.0.0.1:5173'),
    MATCH_CURSOR_SECRET: z.string().min(32).optional(),
    GITHUB_CLIENT_ID: z.string().min(1).optional(),
    GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
    LINKEDIN_CLIENT_ID: z.string().min(1).optional(),
    LINKEDIN_CLIENT_SECRET: z.string().min(1).optional(),
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

    if (value.GITHUB_CLIENT_ID || value.LINKEDIN_CLIENT_ID) {
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

  return {
    companies,
    sources,
    repository,
    adapters,
    ...(accountRepository ? { accounts: new Accounts(accountRepository, providers) } : {}),
    closeAccounts: async () => {
      await accountRepository?.close();
    },
    catalog: new JobCatalog(repository, companies, sources, config.DATA_MODE),
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
    backfill: new BackfillJobFeatures(features, htmlJobDocumentReader),
    closeFeatures: async () => {
      if (features instanceof PostgresJobFeatures) {
        await features.close();
      }
    },
    sync: new SyncSource(
      repository,
      adapters,
      htmlPreparation,
      [new LabelMappingStrategy(), new TitleRuleStrategy()],
      undefined,
      new AuditedPostingValidation(companies, sources, adapters),
    ),
  };
}
