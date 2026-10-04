import { describe, expect, it } from 'vitest';
import { evaluateSemantics } from './evaluate-semantics.js';
import { SemanticJobShadow } from './semantic-shadow.js';
import { RulesJobExtractor } from '../../infrastructure/semantics/rules.js';
import { SemanticExtractionError } from '../../ports/semantic-extractor.js';
import type { SemanticJobExtractor } from '../../ports/semantic-extractor.js';
import {
  evaluationSample,
  semanticDevelopmentCases,
} from '../../test-fixtures/semantic-evaluation.js';

describe('reproducible semantic development evaluation', () => {
  it('runs all five function slices and identifies interpretation gaps separately from localization', async () => {
    const samples = semanticDevelopmentCases.map((sample) => ({
      id: sample.id,
      ...evaluationSample(sample),
    }));

    const report = await evaluateSemantics(new RulesJobExtractor(), samples);

    expect(new Set(semanticDevelopmentCases.map((sample) => sample.category))).toEqual(
      new Set(['engineering', 'data-ai', 'product', 'sales', 'people']),
    );

    expect(report.summary.evaluated).toBe(samples.length);
    expect(report.summary.failed).toBe(0);

    expect(
      report.cases.find((sample) => sample.id === 'failure-paraphrase')!.metrics!.unknownAtoms,
    ).toBeGreaterThan(0);

    expect(
      report.cases.find((sample) => sample.id === 'degree-experience-route')!.metrics!.logic
        .correct,
    ).toBe(0);

    expect(
      report.cases.find((sample) => sample.id === 'application-policy')!.metrics!.localization
        .predicted,
    ).toBe(0);
  });

  it('counts unavailable samples as missed requirements instead of improving recall through omission', async () => {
    const extractor: SemanticJobExtractor = {
      identity: new RulesJobExtractor().identity,
      extract: async () => {
        throw new SemanticExtractionError('unavailable');
      },
    };

    const sample = semanticDevelopmentCases[0]!;

    const report = await evaluateSemantics(extractor, [
      { id: sample.id, ...evaluationSample(sample) },
    ]);

    expect(report.summary).toMatchObject({
      failed: 1,
      evaluated: 0,
      localization: { expected: 1, matched: 0, recall: 0, precision: null },
    });

    expect(report.cases[0]!.error).toBe('unavailable');
  });

  it('keeps rules results visible and reports an experimental failure without publishing a replacement', async () => {
    const baseline = new RulesJobExtractor();

    const experimental: SemanticJobExtractor = {
      identity: baseline.identity,
      extract: async () => {
        throw new Error('private runtime error payload');
      },
    };

    const sample = evaluationSample(semanticDevelopmentCases[0]!);

    const result = await new SemanticJobShadow(baseline, async () => experimental).execute(
      sample.input,
    );

    expect(result).toMatchObject({
      state: 'experimental-failed',
      experimental: null,
      error: 'invalid-output',
    });

    expect(result.baseline.obligations).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('private runtime error payload');
  });

  it('preserves the baseline when local model initialization is unavailable', async () => {
    const baseline = new RulesJobExtractor();

    const shadow = new SemanticJobShadow(baseline, async () => {
      throw new SemanticExtractionError('unavailable');
    });

    const sample = evaluationSample(semanticDevelopmentCases[0]!);

    expect(await shadow.execute(sample.input)).toMatchObject({
      state: 'experimental-failed',
      error: 'unavailable',
      baseline: { obligations: [{ importance: 'required' }] },
    });
  });

  it('aborts evaluation rather than treating cancellation as a measured model failure', async () => {
    const controller = new AbortController();

    controller.abort();

    await expect(
      evaluateSemantics(new RulesJobExtractor(), [], controller.signal),
    ).resolves.toBeDefined();

    const sample = semanticDevelopmentCases[0]!;

    await expect(
      evaluateSemantics(
        new RulesJobExtractor(),
        [{ id: sample.id, ...evaluationSample(sample) }],
        controller.signal,
      ),
    ).rejects.toThrow();
  });
});
