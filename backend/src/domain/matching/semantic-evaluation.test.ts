import { describe, expect, it } from 'vitest';
import { evaluateInterpretation, localizationMetrics } from './semantic-evaluation.js';
import { rulesSemanticExtraction } from './rules-semantic.js';
import {
  evaluationSample,
  semanticDevelopmentCases,
} from '../../test-fixtures/semantic-evaluation.js';

describe('qualification localization metrics', () => {
  it('penalizes duplicate predictions and incorrect required/preferred importance', () => {
    const sample = evaluationSample(semanticDevelopmentCases[0]!);
    const extraction = rulesSemanticExtraction(sample.input);

    extraction.obligations.push({ ...extraction.obligations[0]!, id: 'duplicate' });

    expect(evaluateInterpretation(extraction, sample.labels).localization).toEqual({
      predicted: 2,
      expected: 1,
      matched: 1,
    });

    extraction.obligations.forEach((obligation) => {
      obligation.importance = 'preferred';
    });

    expect(evaluateInterpretation(extraction, sample.labels).localization.matched).toBe(0);
  });

  it('does not claim perfect precision or recall for an empty dataset', () => {
    expect(localizationMetrics({ predicted: 0, expected: 0, matched: 0 })).toEqual({
      predicted: 0,
      expected: 0,
      matched: 0,
      precision: null,
      recall: null,
    });
  });
});
