import type { RequirementExpression, SemanticJobExtraction } from './semantic-model.js';

export interface QualificationLabel {
  blockId: string;
  start: number;
  end: number;
  importance: 'required' | 'preferred';
  logic: 'single' | 'all-of' | 'any-of' | 'conditional';
  minimumMonths: number | null;
  durationScope: 'none' | 'professional' | 'function' | 'activity';
}

export interface LocalizationCounts {
  predicted: number;
  expected: number;
  matched: number;
}

function expressionAtomIds(expression: RequirementExpression): string[] {
  if (expression.kind === 'atom') {
    return [expression.atomId];
  }

  if (expression.kind === 'conditional') {
    return [expression.conditionId, ...expressionAtomIds(expression.then)];
  }

  return expression.children.flatMap(expressionAtomIds);
}

export function evaluateInterpretation(
  extraction: SemanticJobExtraction,
  labels: QualificationLabel[],
) {
  const predicted = extraction.obligations.filter((item) => item.importance !== 'contextual');
  const remaining = new Set(labels.map((_label, index) => index));
  let logicCorrect = 0;
  let durationCorrect = 0;
  let durationExpected = 0;
  let matched = 0;

  for (const obligation of predicted) {
    const index = [...remaining].find((position) => {
      const label = labels[position]!;

      const intersection = Math.max(
        0,
        Math.min(label.end, obligation.source.end) - Math.max(label.start, obligation.source.start),
      );

      const union =
        Math.max(label.end, obligation.source.end) - Math.min(label.start, obligation.source.start);

      return (
        label.blockId === obligation.source.blockId &&
        label.importance === obligation.importance &&
        intersection / union >= 0.5
      );
    });

    if (index === undefined) {
      continue;
    }

    remaining.delete(index);
    matched++;

    const label = labels[index]!;
    const logic = obligation.expression.kind === 'atom' ? 'single' : obligation.expression.kind;
    const ids = new Set(expressionAtomIds(obligation.expression));

    const durations = extraction.atoms.filter(
      (atom) => ids.has(atom.id) && atom.kind === 'experience',
    );

    logicCorrect += Number(logic === label.logic);
    durationExpected += Number(label.minimumMonths !== null);

    durationCorrect += Number(
      label.minimumMonths !== null &&
        durations.some(
          (atom) =>
            atom.minimumMonths === label.minimumMonths &&
            atom.durationScope === label.durationScope,
        ),
    );
  }

  return {
    localization: { predicted: predicted.length, expected: labels.length, matched },
    logic: { correct: logicCorrect, assessed: matched },
    duration: {
      correct: durationCorrect,
      expected: labels.filter((label) => label.minimumMonths !== null).length,
      localized: durationExpected,
    },
    unknownAtoms: extraction.atoms.filter(
      (atom) => atom.kind === 'unknown' || atom.polarity === 'unknown',
    ).length,
    needsReview: extraction.state === 'needs-review',
  };
}

export function localizationMetrics(counts: LocalizationCounts) {
  return {
    ...counts,
    precision: counts.predicted ? counts.matched / counts.predicted : null,
    recall: counts.expected ? counts.matched / counts.expected : null,
  };
}
