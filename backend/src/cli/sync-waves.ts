import { PgBoss } from 'pg-boss';
import { config } from '../bootstrap.js';
import { configureWaveRefreshQueue, waveRefreshQueue } from '../infrastructure/wave-queue.js';

if (config.DATA_MODE !== 'postgres' || !config.DATABASE_URL) {
  throw new Error('Wave refresh requires PostgreSQL configuration');
}

const boss = new PgBoss(config.DATABASE_URL);

boss.on('error', () => console.error('Wave refresh queue unavailable.'));

try {
  await boss.start();
  await configureWaveRefreshQueue(boss);

  const id = await boss.send(waveRefreshQueue);

  console.log(
    id
      ? `Queued A → B → C sync and audits: ${id}. Start a worker with INGESTION_WAVE_SYNC=true.`
      : 'A wave refresh is already queued or running; no overlapping cycle was created.',
  );
} finally {
  await boss.stop();
}
