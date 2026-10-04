import { readJobDocument } from '../../domain/matching/document.js';
import type { JobDocumentReader } from '../../ports/job-document.js';
import { extractRequirements } from '../../domain/matching/requirements.js';
import type { JobFeatureRepository } from '../../ports/job-features.js';

export class BackfillJobFeatures {
  constructor(
    private readonly repository: JobFeatureRepository,
    private readonly documents: JobDocumentReader = {
      read: (input) => readJobDocument(input.descriptionText),
    },
  ) {}

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
        jobs.map((job) => ({
          postingId: job.id,
          requirements: extractRequirements(job, this.documents.read(job)),
        })),
      );

      inspected += jobs.length;
      after = jobs.at(-1)!.id;
    }
  }
}
