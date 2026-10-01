import type { MatchInput, ResumeAnalysis } from '../../api/client.js';

// Explicit allowlist: contact details and resume excerpts never enter matching requests.
function claim({
  id,
  status,
  facets,
  deniedFacets,
  uncertainFacets,
  interpretation,
}: ResumeAnalysis['skills'][number]) {
  return {
    id,
    status,
    ...(facets ? { facets } : {}),
    ...(deniedFacets ? { deniedFacets } : {}),
    ...(uncertainFacets ? { uncertainFacets } : {}),
    ...(interpretation ? { interpretation } : {}),
  };
}

export function matchProfile(analysis: ResumeAnalysis): MatchInput['profile'] {
  return {
    analysisDate: analysis.analysisDate,
    skills: analysis.skills.map(claim),
    competencies: analysis.competencies.map(claim),
    employment: analysis.employment.map(
      ({ employer, category, kind, relationship, start, end }) => ({
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
