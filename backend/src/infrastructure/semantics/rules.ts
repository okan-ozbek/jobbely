import {
  rulesSemanticExtraction,
  rulesExtractionIdentity,
} from '../../domain/matching/rules-semantic.js';
import type { SemanticJobInput } from '../../domain/matching/semantic-model.js';
import { SemanticExtractionError } from '../../ports/semantic-extractor.js';
import type { SemanticJobExtractor } from '../../ports/semantic-extractor.js';

export class RulesJobExtractor implements SemanticJobExtractor {
  readonly identity = rulesExtractionIdentity;

  async extract(input: SemanticJobInput, signal?: AbortSignal) {
    if (signal?.aborted) {
      throw new SemanticExtractionError('cancelled');
    }

    if (input.document.truncated) {
      throw new SemanticExtractionError('input-limit');
    }

    try {
      return rulesSemanticExtraction(input);
    } catch {
      throw new SemanticExtractionError('invalid-output');
    }
  }
}
