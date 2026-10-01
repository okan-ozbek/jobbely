import type { MatchInput, ResumeAnalysis } from '../../api/client.js';

// Explicit allowlist: contact details and resume excerpts never enter matching requests.
export function matchProfile(analysis: ResumeAnalysis): MatchInput['profile'] {
  return {
    analysisDate: analysis.analysisDate,
    skills: analysis.skills.map(({ id, status }) => ({ id, status })),
    competencies: analysis.competencies.map(({ id, status }) => ({ id, status })),
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
