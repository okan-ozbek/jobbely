import type { PgBoss } from 'pg-boss';

export const waveRefreshQueue = 'sync-waves';

export async function configureWaveRefreshQueue(boss: PgBoss) {
  const options = {
    expireInSeconds: 24 * 60 * 60,
    heartbeatSeconds: 60,
    retryLimit: 1,
    retryDelay: 30 * 60,
  };

  await boss.createQueue(waveRefreshQueue, { ...options, policy: 'exclusive' });
  await boss.updateQueue(waveRefreshQueue, options);
}
