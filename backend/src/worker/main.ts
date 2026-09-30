import { PgBoss } from 'pg-boss';
import { bootstrap, config } from '../bootstrap.js';

if (config.DATA_MODE !== 'postgres' || !config.DATABASE_URL) {
  throw new Error('Worker requires PostgreSQL configuration');
}

const dependencies = await bootstrap();
const boss = new PgBoss(config.DATABASE_URL);

boss.on('error', (error) => console.error('Queue failure:', error));
await boss.start();
await boss.createQueue('sync-source');

await boss.work<{ sourceId: string }>('sync-source', { localConcurrency: 1 }, async (jobs) => {
  for (const job of jobs) {
    const source = dependencies.sources.find(
      (item) => item.id === job.data.sourceId && item.scheduled && item.auditStatus === 'verified',
    );

    if (!source) {
      throw new Error('Scheduled source is not enabled and audited');
    }

    await dependencies.sync.execute(source);
  }
});

for (const [index, source] of dependencies.sources.filter((item) => item.scheduled).entries()) {
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

console.log('Worker ready; only audited enabled sources are scheduled.');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void boss
      .stop()
      .then(() => dependencies.repository.close())
      .then(() => process.exit(0));
  });
}
