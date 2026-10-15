import { PgBoss } from 'pg-boss';
import { bootstrap, config } from '../bootstrap.js';
import {
  configureSourceRefreshQueue,
  sourceRefreshQueue,
  companyRefreshQueue,
} from '../infrastructure/source-queue.js';
import {
  CompanyRefreshQueue,
  refreshRegistryHash,
} from '../infrastructure/company-refresh-queue.js';
import type { CompanyRefreshTask } from '../infrastructure/company-refresh-queue.js';
import { FileSourceRefreshReports } from '../infrastructure/audits/source-refresh.js';

if (config.DATA_MODE !== 'postgres' || !config.DATABASE_URL) {
  throw new Error('Worker requires PostgreSQL configuration');
}

const dependencies = await bootstrap();
const boss = new PgBoss(config.DATABASE_URL);

boss.on('error', (error) => console.error('Queue failure:', error));
await boss.start();
await configureSourceRefreshQueue(boss);
await boss.createQueue('backfill-job-features', { expireInSeconds: 30 * 60 });

// Drain old per-source jobs; only the shared exclusive cycle starts source work.
for (const schedule of await boss.getSchedules('sync-source')) {
  await boss.unschedule('sync-source', schedule.key);
}

await boss.createQueue('sync-source');
await boss.work('sync-source', { localConcurrency: 1 }, async () => {});

await boss.work('backfill-job-features', { localConcurrency: 1 }, async () => {
  await dependencies.backfill.execute();
});

await boss.work<CompanyRefreshTask>(
  companyRefreshQueue,
  { localConcurrency: 1, batchSize: 1 },
  async (jobs) => {
    const job = jobs[0]!;

    if (
      job.data.registryHash !== refreshRegistryHash(dependencies.companies, dependencies.sources)
    ) {
      throw new Error(
        'Company refresh configuration changed; deploy identical registries to every replica',
      );
    }

    return dependencies.refreshSources.executeCompany(job.id, job.data.companySlug, job.signal);
  },
);

const coordinator = new CompanyRefreshQueue(
  boss,
  dependencies.companies,
  dependencies.sources,
  new FileSourceRefreshReports(),
  dependencies.backfill,
);

await boss.work(sourceRefreshQueue, { localConcurrency: 1 }, async (jobs) => {
  for (const job of jobs) {
    await coordinator.execute(job.id, job.signal);
  }
});

await boss.schedule('backfill-job-features', '*/15 * * * *');
await boss.schedule(sourceRefreshQueue, '0 */12 * * *', null, { tz: 'UTC' });
await boss.send(sourceRefreshQueue);

console.log('Worker ready; shared company queue, one import per replica, automatic audits.');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void boss
      .stop()
      .then(() => dependencies.closeFeatures())
      .then(() => dependencies.closeAccounts())
      .then(() => dependencies.repository.close())
      .then(() => process.exit(0));
  });
}
