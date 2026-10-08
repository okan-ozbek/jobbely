import { randomUUID } from 'node:crypto';
import type { Dataset, Source } from '../../domain/model.js';
import type { JobRepository, SnapshotCommit } from '../../ports/ingestion.js';
import { applySnapshot } from './snapshot.js';
import type { CatalogFilter } from '../../ports/catalog.js';

export class MemoryJobRepository implements JobRepository {
  private dataset: Dataset = { version: 0, jobs: [], runs: [] };

  async read() {
    return structuredClone(this.dataset);
  }

  async findJob(id: string) {
    return structuredClone(this.dataset.jobs.find((job) => job.id === id) ?? null);
  }

  async searchCatalog(query: CatalogFilter) {
    return {
      version: this.dataset.version,
      jobs: this.dataset.jobs
        .filter(
          (job) =>
            job.status === 'active' &&
            (!query.q ||
              `${job.title} ${job.descriptionText} ${job.departments.join(' ')} ${job.locations.join(' ')}`
                .toLowerCase()
                .includes(query.q.toLowerCase())) &&
            (!query.company || query.company.split(',').includes(job.companySlug)) &&
            (!query.category || query.category.split(',').includes(job.classification.category)) &&
            (!query.workplace || query.workplace.split(',').includes(job.workplace)),
        )
        .map((job) => ({
          id: job.id,
          companySlug: job.companySlug,
          category: job.classification.category,
          locations: [...job.locations],
          workplace: job.workplace,
          lastSeenAt: job.lastSeenAt,
        })),
    };
  }

  async findJobs(ids: string[], version: number) {
    return this.dataset.version === version
      ? structuredClone(this.dataset.jobs.filter((job) => ids.includes(job.id)))
      : null;
  }

  async coverageSnapshot(companySlugs: string[], sourceIds: string[]) {
    const counts: Record<string, number> = Object.create(null) as Record<string, number>;

    for (const job of this.dataset.jobs) {
      if (job.status === 'active' && companySlugs.includes(job.companySlug)) {
        counts[job.companySlug] = (counts[job.companySlug] ?? 0) + 1;
      }
    }

    const runs = sourceIds.flatMap((sourceId) => {
      const history = this.dataset.runs
        .filter((run) => run.sourceId === sourceId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

      const latest = history[0];

      const successful = history.find(
        (run) => run.status === 'succeeded' && run.enumerationComplete,
      );

      return latest
        ? successful && successful.id !== latest.id
          ? [latest, successful]
          : [latest]
        : [];
    });

    return { counts, runs: structuredClone(runs) };
  }

  async startRun(source: Source, at: string) {
    if (this.dataset.runs.some((run) => run.sourceId === source.id && run.status === 'running')) {
      return null;
    }

    const run = {
      id: randomUUID(),
      sourceId: source.id,
      startedAt: at,
      finishedAt: null,
      status: 'running' as const,
      listingCount: 0,
      excludedCount: 0,
      enumerationComplete: false,
      removalsQuarantined: false,
      error: null,
    };

    this.dataset.runs.push(run);

    return structuredClone(run);
  }

  async commitSnapshot(commit: SnapshotCommit) {
    const result = applySnapshot(this.dataset, commit);

    this.dataset = result.dataset;

    return structuredClone(result.run);
  }

  async renewRun(sourceId: string, runId: string): Promise<boolean> {
    return this.dataset.runs.some(
      (run) => run.sourceId === sourceId && run.id === runId && run.status === 'running',
    );
  }

  async failRun(runId: string, at: string, error: string) {
    this.dataset.runs = this.dataset.runs.map((run) =>
      run.id === runId && run.status === 'running'
        ? { ...run, status: 'failed', finishedAt: at, error }
        : run,
    );
  }

  async ping() {}

  async close() {}
}
