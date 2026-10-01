import type { Dataset, Job } from '../../domain/model.js';
import type { FeatureFilter, JobFeatureRepository } from '../../ports/job-features.js';
import type { StoredFeature } from '../../domain/matching/model.js';
import { featureVersion } from '../../domain/matching/requirements.js';

export class MemoryJobFeatures implements JobFeatureRepository {
  private readonly features = new Map<string, StoredFeature>();
  private generation = 0;

  constructor(private readonly read: () => Promise<Dataset>) {}

  async pendingFeatures(after: string, limit: number) {
    return (await this.read()).jobs
      .filter(
        (job) =>
          job.id > after &&
          (this.features.get(job.id)?.requirements.contentHash !== job.contentHash ||
            this.features.get(job.id)?.requirements.version !== featureVersion),
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  async saveFeatures(features: StoredFeature[]) {
    const dataset = await this.read();
    let count = 0;

    for (const feature of features) {
      const job = dataset.jobs.find((item) => item.id === feature.postingId);
      const previous = this.features.get(feature.postingId);

      if (
        job?.contentHash === feature.requirements.contentHash &&
        (previous?.requirements.contentHash !== job.contentHash ||
          previous.requirements.version !== feature.requirements.version)
      ) {
        this.features.set(feature.postingId, structuredClone(feature));
        count++;
      }
    }

    if (count) {
      this.generation++;
    }

    return count;
  }

  async latestRuns() {
    const runs = (await this.read()).runs
      .filter((run) => run.status !== 'running')
      .sort(
        (a, b) =>
          (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '') || b.id.localeCompare(a.id),
      );

    return runs.filter(
      (run, index) => runs.findIndex((item) => item.sourceId === run.sourceId) === index,
    );
  }

  private eligible(job: Job, filter: FeatureFilter) {
    return (
      job.status === 'active' &&
      job.missingSince === null &&
      filter.sourceIds.includes(job.sourceId) &&
      filter.categories.includes(job.classification.category) &&
      job.lastSeenAt >= filter.cutoff
    );
  }

  async featureSnapshot(filter: FeatureFilter) {
    const dataset = await this.read();
    const eligible = dataset.jobs.filter((job) => this.eligible(job, filter));

    return {
      datasetVersion: dataset.version,
      generation: this.generation,
      eligible: eligible.length,
      unenriched: eligible.filter(
        (job) =>
          this.features.get(job.id)?.requirements.version !== featureVersion ||
          this.features.get(job.id)?.requirements.contentHash !== job.contentHash,
      ).length,
    };
  }

  async featureJobs(filter: FeatureFilter, after: string, limit: number) {
    return (await this.read()).jobs
      .filter(
        (job) =>
          job.id > after &&
          this.eligible(job, filter) &&
          this.features.get(job.id)?.requirements.version === featureVersion &&
          this.features.get(job.id)?.requirements.contentHash === job.contentHash,
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, limit)
      .map((job) => ({
        id: job.id,
        sourceId: job.sourceId,
        companySlug: job.companySlug,
        title: job.title,
        url: job.url,
        applyUrl: job.applyUrl,
        lastSeenAt: job.lastSeenAt,
        requirements: structuredClone(this.features.get(job.id)!.requirements),
      }));
  }
}
