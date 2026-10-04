import type { SemanticJobInput } from '../../domain/matching/semantic-model.js';
import { SemanticExtractionError } from '../../ports/semantic-extractor.js';
import type { SemanticJobExtractor } from '../../ports/semantic-extractor.js';

// Read-only experiment: no repository, publishing, candidate input or scoring dependency.
export class SemanticJobShadow {
  constructor(
    private readonly baseline: SemanticJobExtractor,
    private readonly experimental: (signal?: AbortSignal) => Promise<SemanticJobExtractor>,
  ) {}

  async execute(input: SemanticJobInput, signal?: AbortSignal) {
    const baseline = await this.baseline.extract(input, signal);

    try {
      const extractor = await this.experimental(signal);
      const experimental = await extractor.extract(input, signal);

      return { state: 'compared' as const, baseline, experimental, error: null };
    } catch (error) {
      const code = error instanceof SemanticExtractionError ? error.code : 'invalid-output';

      return { state: 'experimental-failed' as const, baseline, experimental: null, error: code };
    }
  }
}
