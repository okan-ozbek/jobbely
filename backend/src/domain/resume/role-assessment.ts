import type { writingSegments } from './review.js';

export interface RoleEvidence {
  area: 'ats' | 'recruiter';
  status: 'supported' | 'partial' | 'not_evidenced';
  jobQuote: string;
  resumeQuote: string | null;
  line: number | null;
  explanation: string;
  suggestion: string;
}

export interface AlignmentAssessment {
  alignment: 'strong' | 'partial' | 'limited' | 'unknown';
  confidence: 'high' | 'moderate' | 'low';
  evidenceCount: number;
}

export interface RoleAssessment {
  aiStatus: 'completed' | 'failed' | 'unavailable';
  ats: AlignmentAssessment;
  recruiter: AlignmentAssessment;
  evidence: RoleEvidence[];
  limitations: string[];
}

export function groundedRoleAssessment(
  rows: RoleEvidence[],
  segments: ReturnType<typeof writingSegments>,
  jobText: string,
  truncated: boolean,
): RoleAssessment {
  const seen = new Set<string>();

  if (rows.length < 2 || rows.length > 8) {
    throw new Error('Incomplete alignment evidence');
  }

  for (const row of rows) {
    const identity = `${row.area}:${row.jobQuote.trim().toLowerCase()}`;
    const segment = segments.find((item) => item.line === row.line);

    if (
      !row.jobQuote.trim() ||
      !jobText.includes(row.jobQuote) ||
      seen.has(identity) ||
      (row.status === 'not_evidenced'
        ? row.resumeQuote !== null || row.line !== null
        : !row.resumeQuote?.trim() || !segment?.text.includes(row.resumeQuote))
    ) {
      throw new Error('Unverified alignment evidence');
    }

    seen.add(identity);
  }

  function area(name: RoleEvidence['area']): AlignmentAssessment {
    const selected = rows.filter((row) => row.area === name);
    const supported = selected.filter((row) => row.status === 'supported').length;
    const quoted = selected.filter((row) => row.resumeQuote !== null).length;

    const distinctLines = new Set(
      selected.filter((row) => row.line !== null).map((row) => row.line),
    ).size;

    if (!selected.length) {
      throw new Error('Incomplete alignment evidence');
    }

    return {
      alignment:
        supported === selected.length && selected.length >= 2
          ? 'strong'
          : quoted
            ? 'partial'
            : 'limited',
      confidence:
        !truncated && supported === selected.length && distinctLines >= 3
          ? 'high'
          : quoted
            ? 'moderate'
            : 'low',
      evidenceCount: selected.length,
    };
  }

  return {
    aiStatus: 'completed',
    ats: area('ats'),
    recruiter: area('recruiter'),
    evidence: rows,
    limitations: [
      'This is a review of selected evidence, not a complete employer screening simulation.',
      'Evidence confidence reflects verified source excerpts. It is not a probability of passing an ATS or recruiter screen.',
      'ATS alignment covers wording and keyword evidence, not file parsing or undisclosed screening rules.',
      'Missing resume evidence does not prove you lack experience. Verify AI suggestions; add only facts you can support.',
      ...(truncated
        ? [
            'The job description was shortened for this assessment; confidence is capped at moderate.',
          ]
        : []),
    ],
  };
}

export function unavailableRoleAssessment(aiStatus: 'failed' | 'unavailable'): RoleAssessment {
  const unknown: AlignmentAssessment = {
    alignment: 'unknown',
    confidence: 'low',
    evidenceCount: 0,
  };

  return {
    aiStatus,
    ats: unknown,
    recruiter: unknown,
    evidence: [],
    limitations: [
      'AI alignment feedback could not be verified. Your existing qualification comparison remains available.',
    ],
  };
}
