import type { Company, Extraction, Source } from '../domain/model.js';
import type {
  RefreshWave,
  WaveAudits,
  WaveRefreshReport,
  WaveRefreshReports,
  WaveSourceSync,
} from '../ports/wave-refresh.js';

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Refresh failed';
}

export class RefreshWaves {
  constructor(
    private readonly companies: Company[],
    private readonly sources: Source[],
    private readonly sync: WaveSourceSync,
    private readonly audits: WaveAudits,
    private readonly reports: WaveRefreshReports,
    private readonly backfill: { execute(): Promise<unknown> },
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(
    id: string,
    selected: readonly RefreshWave[] = ['A', 'B', 'C'],
    signal?: AbortSignal,
    options: { scheduledOnly?: boolean } = {},
  ) {
    const report: WaveRefreshReport = {
      id,
      startedAt: this.clock().toISOString(),
      finishedAt: null,
      status: 'running',
      current: null,
      waves: [],
      error: null,
    };

    let issues = false;

    await this.reports.save(report);

    try {
      // Registry order within a wave is stable; failures do not abandon later employers/waves.
      for (const wave of ['A', 'B', 'C'] as const) {
        signal?.throwIfAborted();

        if (!selected.includes(wave)) {
          continue;
        }

        const waveReport: WaveRefreshReport['waves'][number] = {
          wave,
          companies: [],
          backfillError: null,
        };

        report.waves.push(waveReport);

        for (const company of this.companies.filter((entry) => entry.wave === wave)) {
          signal?.throwIfAborted();

          const sources = this.sources.filter((source) => source.companySlug === company.slug);

          if (options.scheduledOnly && !sources.some((source) => source.scheduled)) {
            continue;
          }

          const companyReport: (typeof waveReport.companies)[number] = {
            company: company.slug,
            sources: [],
            audit: null,
          };

          const snapshots = new Map<string, Extraction>();
          const sourceRunIds = new Map<string, string>();

          waveReport.companies.push(companyReport);

          if (!sources.length) {
            issues = true;

            companyReport.audit = {
              status: 'blocked',
              blockers: ['No configured source for this company'],
              reportPath: null,
            };

            await this.reports.save(report);

            continue;
          }

          for (const source of sources.filter(
            (source) => !options.scheduledOnly || source.scheduled,
          )) {
            signal?.throwIfAborted();
            report.current = { wave, company: company.slug, source: source.id, stage: 'sync' };
            await this.reports.save(report);

            try {
              const result = await this.sync.executeWithEvidence(source, signal);

              snapshots.set(source.id, result.extraction);
              sourceRunIds.set(source.id, result.run.id);

              companyReport.sources.push({
                source: source.id,
                status: 'succeeded',
                runId: result.run.id,
                listings: result.run.listingCount,
                error: null,
              });
            } catch (error) {
              issues = true;

              companyReport.sources.push({
                source: source.id,
                status: 'failed',
                runId: null,
                listings: 0,
                error: message(error),
              });
            }

            await this.reports.save(report);
          }

          report.current = { wave, company: company.slug, source: null, stage: 'audit' };
          signal?.throwIfAborted();
          await this.reports.save(report);

          try {
            companyReport.audit = await this.audits.verify(
              id,
              company,
              sources,
              snapshots,
              sourceRunIds,
            );
          } catch (error) {
            companyReport.audit = {
              status: 'failed',
              blockers: [message(error)],
              reportPath: null,
            };
          }

          issues ||= companyReport.audit.status !== 'passed';
          signal?.throwIfAborted();
          await this.reports.save(report);
        }

        report.current = { wave, company: null, source: null, stage: 'backfill' };
        signal?.throwIfAborted();
        await this.reports.save(report);

        try {
          await this.backfill.execute();
        } catch (error) {
          issues = true;
          waveReport.backfillError = message(error);
        }

        signal?.throwIfAborted();
      }

      report.status = issues ? 'completed_with_issues' : 'succeeded';
    } catch (error) {
      report.status = 'failed';
      report.error = message(error);

      throw error;
    } finally {
      report.current = null;
      report.finishedAt = this.clock().toISOString();
      await this.reports.save(report);
    }

    return report;
  }
}
