import type { AssessmentCoverage, MatchExplanation } from './model.js';
import type { JobRequirements } from './requirements.js';

// Coverage measures completed comparisons, including gaps, rather than positive fit.
// It cannot measure requirements the deterministic extractor did not identify.
export function qualificationAssessment(
  requirements: JobRequirements,
  comparison: Pick<MatchExplanation, 'skills' | 'experience' | 'education'>,
) {
  const criteria = new Map<string, { assessed: boolean; credit: number; weight: number }>();

  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

  const record = (key: unknown[], assessed: boolean, credit: number, importance: string) => {
    const identity = JSON.stringify(key);
    const previous = criteria.get(identity);

    criteria.set(identity, {
      assessed: (previous?.assessed ?? true) && assessed,
      credit: Math.min(previous?.credit ?? 1, assessed ? credit : 0.25),
      weight: importance === 'required' ? 3 : 1,
    });
  };

  const skills = comparison.skills.filter((item) => item.importance !== 'contextual');

  for (const [index, group] of requirements.skills
    .filter((item) => item.importance !== 'contextual')
    .entries()) {
    const match = skills[index]!;

    record(
      [
        'skill',
        group.importance,
        group.alternatives
          .map((item) => [item.id, item.facet ?? 'general', item.interpretation ?? 'explicit'])
          .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
        [...(group.unresolvedAlternatives ?? [])].map(normalize).sort(),
      ],
      !group.unresolvedAlternatives?.length || match.credit === 1,
      match.confidence === 'green' ? 1 : match.confidence === 'yellow' ? 0.25 : 0,
      group.importance,
    );
  }

  for (const [index, requirement] of requirements.experience
    .filter((item) => item.importance !== 'contextual')
    .entries()) {
    record(
      [
        'experience',
        requirement.importance,
        requirement.scope,
        requirement.minimumMonths,
        requirement.maximumMonths ?? null,
        requirement.skillId,
        [...(requirement.alternativeIds ?? [])].sort(),
      ],
      comparison.experience[index]!.status !== 'uncertain',
      Number(comparison.experience[index]!.status === 'met'),
      requirement.importance,
    );
  }

  let educationIndex = 0;

  for (const constraint of requirements.constraints) {
    if (constraint.importance === 'contextual') {
      continue;
    }

    const education = constraint.education ? comparison.education[educationIndex++]! : null;
    const assessed = education !== null && education.status !== 'uncertain';

    record(
      [
        'constraint',
        constraint.importance,
        constraint.kind,
        normalize(constraint.evidence.excerpt),
      ],
      assessed,
      Number(education?.status === 'met'),
      constraint.importance,
    );
  }

  for (const statement of requirements.unparsed) {
    if (statement.importance !== 'contextual') {
      record(
        ['unparsed', statement.importance, normalize(statement.evidence.excerpt)],
        false,
        0.25,
        statement.importance,
      );
    }
  }

  const total = criteria.size;
  const entries = [...criteria.values()];
  const assessed = entries.filter((item) => item.assessed).length;
  const weight = entries.reduce((sum, item) => sum + item.weight, 0);
  const credit = entries.reduce((sum, item) => sum + item.weight * item.credit, 0);

  return {
    coverage: {
      assessed,
      total,
      percentage: total && !requirements.truncated ? Math.round((100 * assessed) / total) : null,
      limited: requirements.truncated,
    },
    fitScore: weight && !requirements.truncated ? (100 * credit) / weight : null,
  };
}

export function assessmentCoverage(
  requirements: JobRequirements,
  comparison: Pick<MatchExplanation, 'skills' | 'experience' | 'education'>,
): AssessmentCoverage {
  return qualificationAssessment(requirements, comparison).coverage;
}

export function assessmentRatio(coverage: AssessmentCoverage) {
  return coverage.limited || coverage.total === 0 ? 0 : coverage.assessed / coverage.total;
}
