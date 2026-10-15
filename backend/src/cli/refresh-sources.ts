import { PgBoss } from 'pg-boss';
import { config } from '../bootstrap.js';
import { configureSourceRefreshQueue, sourceRefreshQueue } from '../infrastructure/source-queue.js';

if (config.DATA_MODE !== 'postgres' || !config.DATABASE_URL) {
  throw new Error('Source refresh requires PostgreSQL configuration');
}

const boss = new PgBoss(config.DATABASE_URL);

boss.on('error', () => console.error('Source refresh queue unavailable.'));

try {
  await boss.start();
  await configureSourceRefreshQueue(boss);

  const id = await boss.send(sourceRefreshQueue);

  console.log(
    id
      ? `Queued ordered sync and audits: ${id}. Start the ingestion worker to process it.`
      : 'A source refresh is already queued or running; no overlapping cycle was created.',
  );
} finally {
  await boss.stop();
}
