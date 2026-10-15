import type { PgBoss } from 'pg-boss';

export const sourceRefreshQueue = 'sync-waves';

export const companyRefreshQueue = 'sync-company';
// Keep the durable queue identity so existing retries and cross-process exclusivity survive
// the workflow migration. Its jobs now run the single ordered source list.

export async function configureSourceRefreshQueue(boss: PgBoss) {
  const options = {
    expireInSeconds: 24 * 60 * 60,
    heartbeatSeconds: 60,
    retryLimit: 1,
    retryDelay: 30 * 60,
  };

  await boss.createQueue(sourceRefreshQueue, { ...options, policy: 'exclusive' });
  await boss.updateQueue(sourceRefreshQueue, options);

  const companyOptions = {
    expireInSeconds: 4 * 60 * 60,
    heartbeatSeconds: 60,
    retryLimit: 2,
    retryDelay: 60,
  };

  // Singleton constrains active jobs by company while allowing pending cycles to
  // remain durable if an earlier coordinator exhausted its retries.
  await boss.createQueue(companyRefreshQueue, { ...companyOptions, policy: 'singleton' });
  await boss.updateQueue(companyRefreshQueue, companyOptions);
}
