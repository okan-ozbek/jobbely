import type { ResumeAnalysis } from '../../api/client.js';

/** Only exact, directly evidenced role estimates become reviewed years on submission. */
export function reviewedSkillTenure(analysis: ResumeAnalysis) {
  const estimates = (analysis.skillTenureEstimates ?? [])
    .filter(
      (estimate) =>
        estimate.minimumMonths === estimate.maximumMonths &&
        analysis.skills.some(
          (skill) =>
            skill.id === estimate.skillId &&
            skill.interpretation === 'explicit' &&
            skill.status !== 'negated' &&
            skill.status !== 'learning' &&
            !skill.deniedFacets?.some((facet) => facet === 'usage' || facet === 'general') &&
            !skill.uncertainFacets?.some((facet) => facet === 'usage' || facet === 'general'),
        ),
    )
    .map(({ skillId, minimumMonths }) => ({ skillId, months: minimumMonths }));

  const claims = new Map(
    (analysis.skillTenure ?? []).map(({ skillId, months }) => [skillId, { skillId, months }]),
  );

  for (const estimate of estimates) {
    if (!claims.has(estimate.skillId)) {
      claims.set(estimate.skillId, estimate);
    }
  }

  return [...claims.values()].slice(0, 100);
}
