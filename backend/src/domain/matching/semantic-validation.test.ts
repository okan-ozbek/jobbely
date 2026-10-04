import { describe, expect, it } from 'vitest';
import { rulesSemanticExtraction } from './rules-semantic.js';
import { validateSemanticDraft, SemanticValidationError } from './semantic-validation.js';
import {
  evaluationSample,
  semanticDevelopmentCases,
} from '../../test-fixtures/semantic-evaluation.js';

describe('semantic source and reference validation', () => {
  it('rejects cross-block evidence borrowing even when both quotations exist', () => {
    const sample = evaluationSample(
      semanticDevelopmentCases.find((item) => item.id === 'preference')!,
    );

    const extraction = rulesSemanticExtraction(sample.input);

    extraction.obligations[0]!.expression = extraction.obligations[1]!.expression;

    expect(() => validateSemanticDraft(extraction, sample.input, extraction.identity)).toThrow(
      SemanticValidationError,
    );
  });

  it('requires unknown dispositions for omitted interpretations instead of silently dropping blocks', () => {
    const sample = evaluationSample(semanticDevelopmentCases[0]!);
    const extraction = rulesSemanticExtraction(sample.input);

    extraction.atoms = [];
    extraction.obligations = [];
    extraction.blocks[0]!.interpretation = 'unknown';
    extraction.blocks[0]!.obligationIds = [];

    expect(validateSemanticDraft(extraction, sample.input, extraction.identity).state).toBe(
      'needs-review',
    );

    extraction.blocks = [];

    expect(() => validateSemanticDraft(extraction, sample.input, extraction.identity)).toThrow(
      SemanticValidationError,
    );
  });
});
