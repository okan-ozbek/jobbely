import 'dotenv/config';
import { z } from 'zod';
import { JobCatalog } from './application/catalog.js';
import { SyncSource } from './application/sync-source.js';
import { LabelMappingStrategy, TitleRuleStrategy } from './domain/classification.js';
import { loadRegistry } from './infrastructure/registry.js';
import { PublicJsonTransport } from './infrastructure/http.js';
import { htmlPreparation } from './infrastructure/html.js';
import { GreenhouseAdapter } from './infrastructure/adapters/greenhouse.js';
import { AshbyAdapter } from './infrastructure/adapters/ashby.js';
import { LeverAdapter } from './infrastructure/adapters/lever.js';
import { MemoryJobRepository } from './infrastructure/storage/memory.js';
import { PostgresJobRepository } from './infrastructure/storage/postgres.js';
import { seedDemo } from './infrastructure/demo.js';
import { AuditedPostingValidation } from './infrastructure/audits/validation.js';

export const config = z
  .object({
    DATA_MODE: z.enum(['demo', 'postgres']).default('demo'),
    DATABASE_URL: z.string().optional(),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    HOST: z.string().default('127.0.0.1'),
    FRONTEND_ORIGIN: z.url().default('http://127.0.0.1:5173'),
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

  const adapters = {
    greenhouse: new GreenhouseAdapter(http),
    ashby: new AshbyAdapter(http),
    lever: new LeverAdapter(http),
  };

  return {
    companies,
    sources,
    repository,
    adapters,
    catalog: new JobCatalog(repository, companies, sources, config.DATA_MODE),
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
