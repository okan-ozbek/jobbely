import { createHash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import type { PgBoss } from 'pg-boss';
import type { Company, Source } from '../domain/model.js';
import type { SourceRefreshReport, SourceRefreshReports } from '../ports/source-refresh.js';
import { companyRefreshQueue } from './source-queue.js';

export interface CompanyRefreshTask {
  cycleId: string;
  companySlug: string;
  registryHash: string;
}

export function refreshRegistryHash(companies: Company[], sources: Source[]) {
  return createHash('sha256')
    .update(JSON.stringify([companies, sources]))
    .digest('hex');
}

function taskId(cycleId: string, slug: string) {
  const value = createHash('sha256').update(`${cycleId}:${slug}`).digest('hex');

  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

export class CompanyRefreshQueue {
  constructor(
    private readonly boss: PgBoss,
    private readonly companies: Company[],
    private readonly sources: Source[],
    private readonly reports: SourceRefreshReports,
    private readonly backfill: { execute(): Promise<unknown> },
  ) {}

  async execute(cycleId: string, signal?: AbortSignal) {
    let jobs = await this.boss.findJobs<CompanyRefreshTask>(companyRefreshQueue, {
      data: { cycleId },
    });

    const startedAt = new Date().toISOString();

    const report: SourceRefreshReport = {
      id: cycleId,
      startedAt,
      finishedAt: null,
      status: 'running',
      current: null,
      companies: [],
      backfillError: null,
      error: null,
    };

    try {
      if (!jobs.length) {
        const selected = this.companies.filter((company) =>
          this.sources.some((source) => source.companySlug === company.slug && source.scheduled),
        );

        const registryHash = refreshRegistryHash(this.companies, this.sources);

        signal?.throwIfAborted();

        // One atomic insert; deterministic IDs make dispatcher retries idempotent.
        await this.boss.insert(
          companyRefreshQueue,
          selected.map((company, index) => ({
            id: taskId(cycleId, company.slug),
            singletonKey: company.slug,
            priority: selected.length - index,
            data: { cycleId, companySlug: company.slug, registryHash },
          })),
        );

        jobs = await this.boss.findJobs<CompanyRefreshTask>(companyRefreshQueue, {
          data: { cycleId },
        });

        if (jobs.length !== selected.length) {
          throw new Error('Company dispatch incomplete');
        }
      }

      let previousProgress = '';

      for (;;) {
        signal?.throwIfAborted();

        jobs.sort(
          (left, right) => right.priority - left.priority || left.id.localeCompare(right.id),
        );

        report.companies = jobs.map((job) => {
          const output = job.output as unknown as SourceRefreshReport | undefined;

          return (
            output?.companies?.[0] ?? {
              company: job.data.companySlug,
              sources: [],
              audit: ['failed', 'cancelled'].includes(job.state)
                ? {
                    status: 'failed',
                    blockers: ['Company queue task did not complete; inspect its task report'],
                    reportPath: null,
                  }
                : null,
            }
          );
        });

        const progress = JSON.stringify(jobs.map((job) => [job.id, job.state, job.output]));

        if (progress !== previousProgress) {
          await this.reports.save(report);
          previousProgress = progress;
        }

        if (jobs.every((job) => ['completed', 'failed', 'cancelled'].includes(job.state))) {
          break;
        }

        await setTimeout(2000, undefined, signal ? { signal } : {});

        jobs = await this.boss.findJobs<CompanyRefreshTask>(companyRefreshQueue, {
          data: { cycleId },
        });
      }

      report.current = { company: null, source: null, stage: 'backfill' };
      await this.reports.save(report);

      try {
        await this.backfill.execute();
      } catch (error) {
        report.backfillError = error instanceof Error ? error.message : 'Backfill failed';
      }

      report.status =
        report.backfillError ||
        jobs.some(
          (job) =>
            job.state !== 'completed' ||
            (job.output as unknown as SourceRefreshReport)?.status !== 'succeeded',
        )
          ? 'completed_with_issues'
          : 'succeeded';
    } catch (error) {
      report.status = 'failed';
      report.error = error instanceof Error ? error.message : 'Refresh failed';

      throw error;
    } finally {
      report.current = null;
      report.finishedAt = new Date().toISOString();
      await this.reports.save(report);
    }

    return report;
  }
}
