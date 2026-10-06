import { PgBoss } from 'pg-boss';
import { bootstrap, config } from '../bootstrap.js';
import { configureWaveRefreshQueue, waveRefreshQueue } from '../infrastructure/wave-queue.js';

if (config.DATA_MODE !== 'postgres' || !config.DATABASE_URL) {
  throw new Error('Worker requires PostgreSQL configuration');
}

const dependencies = await bootstrap();
const boss = new PgBoss(config.DATABASE_URL);

boss.on('error', (error) => console.error('Queue failure:', error));
await boss.start();
await boss.createQueue('sync-source', { expireInSeconds: 3 * 60 * 60 });
await boss.updateQueue('sync-source', { expireInSeconds: 3 * 60 * 60 });
await boss.createQueue('backfill-job-features', { expireInSeconds: 30 * 60 });

await boss.work('backfill-job-features', { localConcurrency: 1 }, async () => {
  await dependencies.backfill.execute();
});

await boss.schedule('backfill-job-features', '*/15 * * * *');

if (config.INGESTION_WAVE_SYNC) {
  await configureWaveRefreshQueue(boss);

  await boss.work(waveRefreshQueue, { localConcurrency: 1 }, async (jobs) => {
    for (const job of jobs) {
      await dependencies.refreshWaves.execute(job.id, undefined, job.signal, {
        scheduledOnly: true,
      });
    }
  });

  await boss.schedule(waveRefreshQueue, '0 */12 * * *', null, { tz: 'UTC' });
  // Exclusive queue policy suppresses overlapping startup/cron/manual requests globally.
  await boss.send(waveRefreshQueue);
} else {
  await boss.unschedule(waveRefreshQueue);
}

for (const schedule of await boss.getSchedules('sync-source')) {
  if (
    config.INGESTION_WAVE_SYNC ||
    !dependencies.sources.some((source) => source.id === schedule.key && source.scheduled)
  ) {
    await boss.unschedule('sync-source', schedule.key);
  }
}

await boss.work<{ sourceId: string }>('sync-source', { localConcurrency: 1 }, async (jobs) => {
  for (const job of jobs) {
    if (config.INGESTION_WAVE_SYNC) {
      // Old per-source jobs must not compete with the ordered wave cycle.
      continue;
    }

    const source = dependencies.sources.find(
      (item) => item.id === job.data.sourceId && item.scheduled,
    );

    if (!source) {
      throw new Error('Scheduled source is not enabled');
    }

    await dependencies.sync.execute(source);
    await dependencies.backfill.execute();
  }
});

for (const [index, source] of dependencies.sources
  .filter((item) => item.scheduled && !config.INGESTION_WAVE_SYNC)
  .entries()) {
  await boss.schedule(
    'sync-source',
    `${index % 60} */12 * * *`,
    { sourceId: source.id },
    {
      key: source.id,
      tz: 'UTC',
      retryLimit: 2,
      retryDelay: 60,
      retryBackoff: true,
    },
  );
}

console.log(
  config.INGESTION_WAVE_SYNC
    ? 'Worker ready; sequential A → B → C sync and automatic audits enabled.'
    : 'Worker ready; enabled sources are scheduled; audit and publication gates remain active.',
);

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
