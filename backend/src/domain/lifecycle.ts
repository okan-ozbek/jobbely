import type { Job } from './model.js';

const DAY = 24 * 60 * 60 * 1000;

export function markMissing(job: Job, observedAt: string): Job {
  if (job.status === 'closed') {
    return job;
  }

  const count = job.missingCount + 1;
  const since = job.missingSince ?? observedAt;
  const close = count >= 2 && Date.parse(observedAt) - Date.parse(since) >= DAY;

  return {
    ...job,
    missingCount: count,
    missingSince: since,
    lastMissingAt: observedAt,
    status: close ? 'closed' : 'active',
    closedAt: close ? observedAt : null,
  };
}

export function shouldQuarantine(previousCount: number, nextCount: number): boolean {
  return previousCount > 0 && (previousCount - nextCount) / previousCount > 0.3;
}
