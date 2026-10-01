import { extractRequirements } from '../../domain/matching/requirements.js';
import type { JobFeatureRepository } from '../../ports/job-features.js';

export class BackfillJobFeatures {
  constructor(private readonly repository: JobFeatureRepository) {}

  async execute() {
    let after = '';
    let inspected = 0;
    let updated = 0;

    for (;;) {
      const jobs = await this.repository.pendingFeatures(after, 100);

      if (!jobs.length) {
        return { inspected, updated };
      }

      updated += await this.repository.saveFeatures(
        jobs.map((job) => ({ postingId: job.id, requirements: extractRequirements(job) })),
      );

      inspected += jobs.length;
      after = jobs.at(-1)!.id;
    }
  }
}
