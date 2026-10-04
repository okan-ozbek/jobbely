import type {
  ExtractionIdentity,
  SemanticJobExtraction,
  SemanticJobInput,
} from '../domain/matching/semantic-model.js';

export class SemanticExtractionError extends Error {
  constructor(
    public readonly code:
      'unavailable' | 'invalid-output' | 'input-limit' | 'cancelled' | 'busy' | 'model-changed',
  ) {
    super(`Semantic extraction failed: ${code}.`);
  }
}

export interface SemanticJobExtractor {
  readonly identity: ExtractionIdentity;
  extract(input: SemanticJobInput, signal?: AbortSignal): Promise<SemanticJobExtraction>;
}
