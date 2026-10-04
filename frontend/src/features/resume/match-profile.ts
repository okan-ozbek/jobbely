import type { MatchInput, ResumeAnalysis } from '../../api/client.js';

// Explicit allowlist: contact details and resume excerpts never enter matching requests.
function claim({
  id,
  status,
  facets,
  deniedFacets,
  uncertainFacets,
  interpretation,
  evidenceRefs,
}: ResumeAnalysis['skills'][number]) {
  // Accept explicit self-reports without inventing development experience or
  // overriding a denied/unsure answer. Inference retains its original scope.
  const accepted = status === 'mentioned' && interpretation === 'explicit';
  const acceptedFacets = accepted
    ? (uncertainFacets ?? []).filter((facet) => facet !== 'development' && !deniedFacets?.includes(facet))
    : [];
  const remainingUncertainty = uncertainFacets?.filter((facet) => !acceptedFacets.includes(facet));

  return {
    id,
    status: accepted ? 'user_confirmed' as const : status,
    ...(facets || acceptedFacets.length ? { facets: [...new Set([...(facets ?? []), ...acceptedFacets])] } : {}),
    ...(deniedFacets ? { deniedFacets } : {}),
    ...(remainingUncertainty ? { uncertainFacets: remainingUncertainty } : {}),
    ...(interpretation ? { interpretation } : {}),
    ...(evidenceRefs
      ? {
          evidenceRefs: evidenceRefs.map(
            ({ blockId, lineIds, source, roleId, action, objectId, outcome, assertion }) => ({
              blockId,
              lineIds: [...lineIds],
              source,
              ...(roleId ? { roleId } : {}),
              action,
              objectId,
              outcome,
              assertion,
            }),
          ),
        }
      : {}),
  };
}

export function matchProfile(analysis: ResumeAnalysis): MatchInput['profile'] {
  return {
    analysisDate: analysis.analysisDate,
    skills: analysis.skills.map(claim),
    competencies: analysis.competencies.map(claim),
    employment: analysis.employment.map(
      ({ id, employer, category, kind, relationship, start, end }) => ({
        id,
        employer,
        category,
        kind,
        relationship,
        start,
        end,
      }),
    ),
    location: { value: analysis.location.value, status: analysis.location.status },
  };
}
