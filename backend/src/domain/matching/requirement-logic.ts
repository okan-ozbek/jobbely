import type {
  AtomAssessment,
  EvidenceDecision,
  RequirementExpression,
  SemanticObligation,
} from './semantic-model.js';

export const coverageVersion = 'qualification-coverage-1';

export interface ExpressionAssessment {
  decision: EvidenceDecision | 'not-applicable';
  lower: number;
  upper: number;
  evidenceIds: string[];
}

const unknown = (): ExpressionAssessment => ({
  decision: 'unknown',
  lower: 0,
  upper: 1,
  evidenceIds: [],
});

function assessAtom(assessment: AtomAssessment | undefined): ExpressionAssessment {
  if (!assessment || assessment.decision === 'unknown') {
    return unknown();
  }

  const credit =
    assessment.decision === 'supported' ? 1 : assessment.decision === 'partial' ? 0.5 : 0;

  return {
    decision: assessment.decision,
    lower: credit,
    upper: credit,
    evidenceIds: [...new Set(assessment.evidenceIds)],
  };
}

export function assessExpression(
  expression: RequirementExpression,
  assessments: ReadonlyMap<string, AtomAssessment>,
  depth = 0,
): ExpressionAssessment {
  if (depth > 8) {
    return unknown();
  }

  if (expression.kind === 'atom') {
    return assessAtom(assessments.get(expression.atomId));
  }

  if (expression.kind === 'conditional') {
    const condition = assessments.get(expression.conditionId);

    if (condition?.decision === 'supported') {
      return assessExpression(expression.then, assessments, depth + 1);
    }

    if (condition?.decision === 'contradicted') {
      return { decision: 'not-applicable', lower: 0, upper: 0, evidenceIds: [] };
    }

    // Missing evidence for a condition is not proof that the condition is false.
    return unknown();
  }

  const evaluated = expression.children.map((child) =>
    assessExpression(child, assessments, depth + 1),
  );

  const children = evaluated.filter((child) => child.decision !== 'not-applicable');

  if (!children.length) {
    return evaluated.length
      ? { decision: 'not-applicable', lower: 0, upper: 0, evidenceIds: [] }
      : unknown();
  }

  if (expression.kind === 'any-of') {
    const best = [...children].sort((a, b) => b.lower - a.lower || b.upper - a.upper)[0]!;
    const upper = Math.max(...children.map((child) => child.upper));

    return {
      ...best,
      upper,
      decision: best.lower === 1 ? 'supported' : upper > best.lower ? 'unknown' : best.decision,
    };
  }

  const lower = Math.min(...children.map((child) => child.lower));
  const upper = Math.min(...children.map((child) => child.upper));
  const blocker = children.find((child) => child.decision === 'contradicted');
  const missing = children.find((child) => child.decision === 'not-evidenced');

  return {
    decision:
      lower === 1
        ? 'supported'
        : blocker
          ? 'contradicted'
          : upper > lower
            ? 'unknown'
            : missing
              ? 'not-evidenced'
              : lower > 0
                ? 'partial'
                : 'suggested',
    lower,
    upper,
    evidenceIds: [...new Set(children.flatMap((child) => child.evidenceIds))],
  };
}

export interface QualificationCoverage {
  lowerPercent: number | null;
  upperPercent: number | null;
  total: number;
  supported: number;
  partial: number;
  notEvidenced: number;
  contradicted: number;
  unknown: number;
  suggested: number;
  notApplicable: number;
  needsReview: boolean;
}

export function qualificationCoverage(
  obligations: SemanticObligation[],
  assessments: AtomAssessment[],
  importance: 'required' | 'preferred',
  interpretationComplete: boolean,
): QualificationCoverage {
  const byAtom = new Map<string, AtomAssessment>();

  for (const assessment of assessments) {
    const previous = byAtom.get(assessment.atomId);

    // Contradiction wins; other inconsistent assessments require review.
    byAtom.set(
      assessment.atomId,
      previous && previous.decision !== assessment.decision
        ? {
            atomId: assessment.atomId,
            decision: [previous.decision, assessment.decision].includes('contradicted')
              ? 'contradicted'
              : 'unknown',
            evidenceIds: [],
          }
        : assessment,
    );
  }

  const selected = [
    ...new Map(
      obligations.filter((item) => item.importance === importance).map((item) => [item.id, item]),
    ).values(),
  ];

  const results = selected.map((item) => assessExpression(item.expression, byAtom));
  const applicable = results.filter((item) => item.decision !== 'not-applicable');

  const count = (decision: ExpressionAssessment['decision']) =>
    results.filter((item) => item.decision === decision).length;

  const percentage = (bound: 'lower' | 'upper') =>
    interpretationComplete && applicable.length
      ? Math.round(
          (1000 * applicable.reduce((sum, item) => sum + item[bound], 0)) / applicable.length,
        ) / 10
      : null;

  return {
    lowerPercent: percentage('lower'),
    upperPercent: percentage('upper'),
    total: applicable.length,
    supported: count('supported'),
    partial: count('partial'),
    notEvidenced: count('not-evidenced'),
    contradicted: count('contradicted'),
    unknown: count('unknown'),
    suggested: count('suggested'),
    notApplicable: count('not-applicable'),
    needsReview: !interpretationComplete || count('unknown') > 0 || applicable.length === 0,
  };
}
