import { createHash } from 'node:crypto';
import { classify } from '../domain/classification.js';
import type { ClassificationStrategy } from '../domain/classification.js';
import type { NormalizedPosting, Provider, Source } from '../domain/model.js';
import type {
  HtmlPreparation,
  JobRepository,
  PostingValidation,
  SourceAdapter,
} from '../ports/ingestion.js';

export class SyncSource {
  constructor(
    private readonly repository: JobRepository,
    private readonly adapters: Readonly<Record<Provider, SourceAdapter>>,
    private readonly html: HtmlPreparation,
    private readonly strategies: readonly ClassificationStrategy[],
    private readonly clock: () => Date = () => new Date(),
    private readonly validation?: PostingValidation,
  ) {}

  async execute(source: Source) {
    return (await this.executeWithEvidence(source)).run;
  }

  async executeWithEvidence(source: Source, signal?: AbortSignal) {
    signal?.throwIfAborted();

    const startedAt = this.clock().toISOString();
    const run = await this.repository.startRun(source, startedAt);

    if (!run) {
      throw new Error(`Source ${source.id} is already being synchronized`);
    }

    let renewal: Promise<void> = Promise.resolve();
    let renewing = false;
    let leaseFailure: Error | undefined;

    const heartbeat = setInterval(() => {
      if (renewing || leaseFailure) {
        return;
      }

      renewing = true;

      renewal = this.repository
        .renewRun(source.id, run.id, this.clock().toISOString())
        .then((owned) => {
          if (!owned) {
            throw new Error('Source lease lost during extraction');
          }
        })
        .catch((error: unknown) => {
          leaseFailure = error instanceof Error ? error : new Error('Source lease renewal failed');
        })
        .finally(() => {
          renewing = false;
        });
    }, 60_000);

    heartbeat.unref();

    try {
      const extraction = await this.adapters[source.provider].extract(source);

      signal?.throwIfAborted();

      const auditResponses = (await this.validation?.validate(source, extraction)) ?? [];

      signal?.throwIfAborted();

      await renewal;

      if (leaseFailure) {
        throw leaseFailure;
      }

      signal?.throwIfAborted();

      const ids = new Set<string>();

      const postings: NormalizedPosting[] = extraction.postings.map((posting) => {
        if (ids.has(posting.sourcePostingId)) {
          throw new Error(`Duplicate posting ID: ${posting.sourcePostingId}`);
        }

        ids.add(posting.sourcePostingId);

        const prepared = this.html.prepare(posting.descriptionHtml);

        if (!prepared.text.trim()) {
          throw new Error(`Empty description: ${posting.sourcePostingId}`);
        }

        const normalized = {
          ...posting,
          descriptionHtml: prepared.html,
          descriptionText: prepared.text,
          classification: classify(posting, source.companySlug, this.strategies),
        };

        return {
          ...normalized,
          contentHash: createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),
        };
      });

      const committed = await this.repository.commitSnapshot({
        source,
        runId: run.id,
        observedAt: this.clock().toISOString(),
        postings,
        rawResponses: [...extraction.rawResponses, ...auditResponses],
        excluded: extraction.excluded,
        enumerationComplete: extraction.enumerationComplete,
      });

      return { run: committed, extraction };
    } catch (error) {
      await this.repository.failRun(
        run.id,
        this.clock().toISOString(),
        error instanceof Error ? error.message : 'Unknown ingestion failure',
      );

      throw error;
    } finally {
      clearInterval(heartbeat);
      await renewal;
    }
  }
}
