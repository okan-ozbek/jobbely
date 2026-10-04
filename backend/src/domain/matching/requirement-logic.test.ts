import { describe, expect, it } from 'vitest';
import { assessExpression, qualificationCoverage } from './requirement-logic.js';
import type {
  AtomAssessment,
  EvidenceDecision,
  RequirementExpression,
  SemanticObligation,
} from './semantic-model.js';

const leaf = (atomId: string): RequirementExpression => ({ kind: 'atom', atomId });

const assessment = (atomId: string, decision: EvidenceDecision): AtomAssessment => ({
  atomId,
  decision,
  evidenceIds: [`evidence-${atomId}`],
});

const obligation = (
  id: string,
  expression = leaf(id),
  importance: SemanticObligation['importance'] = 'required',
): SemanticObligation => ({
  id,
  expression,
  importance,
  source: { blockId: id, start: 0, end: 1, quote: 'x' },
});

describe('qualification expressions and coverage', () => {
  it('requires every conjunct and never credits only the easiest skill', () => {
    const decisions = new Map(
      [assessment('design', 'supported'), assessment('operate', 'partial')].map((item) => [
        item.atomId,
        item,
      ]),
    );

    expect(
      assessExpression({ kind: 'all-of', children: [leaf('design'), leaf('operate')] }, decisions),
    ).toMatchObject({ decision: 'partial', lower: 0.5, upper: 0.5 });
  });

  it('accepts an equivalent route without requiring the unused degree alternative', () => {
    const expression: RequirementExpression = {
      kind: 'any-of',
      children: [leaf('degree'), { kind: 'all-of', children: [leaf('experience'), leaf('scope')] }],
    };

    const decisions = new Map(
      [assessment('experience', 'supported'), assessment('scope', 'supported')].map((item) => [
        item.atomId,
        item,
      ]),
    );

    expect(assessExpression(expression, decisions)).toMatchObject({
      decision: 'supported',
      lower: 1,
      upper: 1,
    });
  });

  it('retains unknown alternatives in the upper bound without manufacturing full coverage', () => {
    const decisions = new Map([['known', assessment('known', 'partial')]]);

    expect(
      assessExpression({ kind: 'any-of', children: [leaf('known'), leaf('unknown')] }, decisions),
    ).toMatchObject({ decision: 'unknown', lower: 0.5, upper: 1 });
  });

  it.each(['not-evidenced', 'unknown', 'partial', 'suggested'] as const)(
    'does not interpret %s condition evidence as a false condition',
    (decision) => {
      const expression: RequirementExpression = {
        kind: 'conditional',
        conditionId: 'condition',
        then: leaf('requirement'),
      };

      expect(
        assessExpression(expression, new Map([['condition', assessment('condition', decision)]])),
      ).toMatchObject({ decision: 'unknown', lower: 0, upper: 1 });
    },
  );

  it('excludes explicitly false conditions and evaluates explicitly true conditions', () => {
    const expression: RequirementExpression = {
      kind: 'conditional',
      conditionId: 'condition',
      then: leaf('requirement'),
    };

    expect(
      assessExpression(
        expression,
        new Map([['condition', assessment('condition', 'contradicted')]]),
      ),
    ).toMatchObject({ decision: 'not-applicable' });

    expect(
      assessExpression(
        expression,
        new Map([
          ['condition', assessment('condition', 'supported')],
          ['requirement', assessment('requirement', 'partial')],
        ]),
      ),
    ).toMatchObject({ decision: 'partial' });
  });

  it('does not create a coverage denominator from entirely inapplicable conditions', () => {
    const conditional: RequirementExpression = {
      kind: 'conditional',
      conditionId: 'remote',
      then: leaf('location'),
    };

    const decisions = [assessment('remote', 'contradicted')];

    const expression: RequirementExpression = {
      kind: 'all-of',
      children: [conditional, conditional],
    };

    expect(
      qualificationCoverage([obligation('conditions', expression)], decisions, 'required', true),
    ).toMatchObject({ total: 0, notApplicable: 1, lowerPercent: null });
  });

  it('keeps required and preferred coverage independent and counts an OR once', () => {
    const obligations = [
      obligation('required', { kind: 'any-of', children: [leaf('java'), leaf('kotlin')] }),
      obligation('nice', leaf('docker'), 'preferred'),
    ];

    const decisions = [assessment('kotlin', 'supported'), assessment('docker', 'not-evidenced')];

    expect(qualificationCoverage(obligations, decisions, 'required', true)).toMatchObject({
      total: 1,
      lowerPercent: 100,
    });

    expect(qualificationCoverage(obligations, decisions, 'preferred', true)).toMatchObject({
      total: 1,
      lowerPercent: 0,
    });
  });

  it('calculates evidence coverage over all distinct obligations rather than assessed dimensions', () => {
    const obligations = Array.from({ length: 8 }, (_, index) => obligation(String(index)));

    const decisions = obligations.map((item, index) =>
      assessment(item.id, index < 4 ? 'supported' : index < 6 ? 'partial' : 'not-evidenced'),
    );

    expect(qualificationCoverage(obligations, decisions, 'required', true)).toMatchObject({
      total: 8,
      supported: 4,
      partial: 2,
      notEvidenced: 2,
      lowerPercent: 62.5,
      upperPercent: 62.5,
    });
  });

  it('retains unknown obligations in the denominator and shows a range', () => {
    const obligations = [obligation('met'), obligation('unknown')];

    expect(
      qualificationCoverage(obligations, [assessment('met', 'supported')], 'required', true),
    ).toMatchObject({
      total: 2,
      unknown: 1,
      lowerPercent: 50,
      upperPercent: 100,
      needsReview: true,
    });
  });

  it('suppresses headline percentages when obligation interpretation is incomplete or absent', () => {
    expect(
      qualificationCoverage(
        [obligation('met')],
        [assessment('met', 'supported')],
        'required',
        false,
      ),
    ).toMatchObject({ lowerPercent: null, upperPercent: null, needsReview: true });

    expect(qualificationCoverage([], [], 'required', true)).toMatchObject({
      lowerPercent: null,
      upperPercent: null,
      total: 0,
    });
  });

  it('does not count duplicate obligations twice and never overrides explicit contradiction', () => {
    const item = obligation('skill');

    expect(
      qualificationCoverage(
        [item, item],
        [assessment('skill', 'supported'), assessment('skill', 'contradicted')],
        'required',
        true,
      ),
    ).toMatchObject({ total: 1, contradicted: 1, lowerPercent: 0 });
  });

  it('does not manufacture evidence credit from a suggestion', () => {
    expect(
      qualificationCoverage(
        [obligation('tool')],
        [assessment('tool', 'suggested')],
        'required',
        true,
      ),
    ).toMatchObject({ lowerPercent: 0, upperPercent: 0, suggested: 1 });
  });
});
