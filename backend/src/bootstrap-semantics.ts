import 'dotenv/config';
import { OllamaJobExtractor } from './infrastructure/semantics/ollama.js';
import { RulesJobExtractor } from './infrastructure/semantics/rules.js';
import { SemanticJobShadow } from './application/resume/semantic-shadow.js';
import { SemanticExtractionError } from './ports/semantic-extractor.js';

export async function createExperimentalJobExtractor(signal?: AbortSignal) {
  const model = process.env['SEMANTIC_JOB_MODEL'];
  const digest = process.env['SEMANTIC_JOB_MODEL_DIGEST'];

  if (!model || !digest) {
    throw new SemanticExtractionError('unavailable');
  }

  return OllamaJobExtractor.create(
    {
      model,
      digest,
      ...(process.env['SEMANTIC_JOB_BASE_URL']
        ? { baseUrl: process.env['SEMANTIC_JOB_BASE_URL'] }
        : {}),
    },
    signal,
  );
}

export function createSemanticJobShadow() {
  return new SemanticJobShadow(new RulesJobExtractor(), createExperimentalJobExtractor);
}
