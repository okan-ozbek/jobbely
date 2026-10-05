import type { AssessmentCoverage, MatchExplanation } from './model.js';
import type { JobRequirements } from './requirements.js';

// Coverage measures completed comparisons, including gaps, rather than positive fit.
// It cannot measure requirements the deterministic extractor did not identify.
export function assessmentCoverage(
  requirements: JobRequirements,
  comparison: Pick<MatchExplanation, 'skills' | 'experience' | 'education'>,
): AssessmentCoverage {
  const criteria = new Map<string, boolean>();

  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

  const record = (key: unknown[], assessed: boolean) => {
    const identity = JSON.stringify(key);

    criteria.set(identity, (criteria.get(identity) ?? true) && assessed);
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
    );
  }

  let educationIndex = 0;

  for (const constraint of requirements.constraints) {
    if (constraint.importance === 'contextual') {
      continue;
    }

    const assessed = constraint.education
      ? comparison.education[educationIndex++]!.status !== 'uncertain'
      : false;

    record(
      [
        'constraint',
        constraint.importance,
        constraint.kind,
        normalize(constraint.evidence.excerpt),
      ],
      assessed,
    );
  }

  for (const statement of requirements.unparsed) {
    if (statement.importance !== 'contextual') {
      record(['unparsed', statement.importance, normalize(statement.evidence.excerpt)], false);
    }
  }

  const total = criteria.size;
  const assessed = [...criteria.values()].filter(Boolean).length;

  return {
    assessed,
    total,
    percentage: total && !requirements.truncated ? Math.round((100 * assessed) / total) : null,
    limited: requirements.truncated,
  };
}

export function assessmentRatio(coverage: AssessmentCoverage) {
  return coverage.limited || coverage.total === 0 ? 0 : coverage.assessed / coverage.total;
}
