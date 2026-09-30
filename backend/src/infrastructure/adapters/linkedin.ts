import type { Extraction } from '../../domain/model.js';
import type { SourceAdapter } from '../../ports/ingestion.js';

/** LinkedIn currently requires express permission for automated access; no general-jobs scrape. */
export class LinkedInAdapter implements SourceAdapter {
  async extract(): Promise<Extraction> {
    throw new Error(
      'LinkedIn integration blocked: its published robots policy requires express permission for automated access. Obtain an authorized employer feed before enabling extraction.',
    );
  }
}
