import type { Extraction } from '../../domain/model.js';
import type { SourceAdapter } from '../../ports/ingestion.js';

/** Explicit source failure preserves last-known data without representing a restriction as zero jobs. */
export class RestrictedAdapter implements SourceAdapter {
  constructor(private readonly reason: string) {}

  async extract(): Promise<Extraction> {
    throw new Error(this.reason);
  }
}
