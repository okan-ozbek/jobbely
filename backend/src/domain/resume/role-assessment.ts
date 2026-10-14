import type { writingSegments } from './review.js';

export interface RoleEvidence {
  area: 'ats' | 'recruiter';
  status: 'supported' | 'partial' | 'not_evidenced' | 'contradicted';
  priority: 'required' | 'preferred' | 'responsibility';
  jobQuote: string;
  resumeQuote: string | null;
  line: number | null;
  explanation: string;
  suggestion: string;
  rewrite: string | null;
}

export interface AlignmentAssessment {
  alignment: 'strong' | 'partial' | 'limited' | 'unknown';
  confidence: 'high' | 'moderate' | 'low';
  evidenceCount: number;
  screening:
    | 'potential_fit'
    | 'needs_clarification'
    | 'requirements_not_demonstrated'
    | 'insufficient_context';
  requiredGaps: number;
}

export interface RoleAssessment {
  aiStatus: 'completed' | 'failed' | 'unavailable';
  ats: AlignmentAssessment;
  recruiter: AlignmentAssessment;
  evidence: RoleEvidence[];
  coverage: 'all_identified' | 'partial';
  limitations: string[];
}

export function groundedRoleAssessment(
  rows: RoleEvidence[],
  segments: ReturnType<typeof writingSegments>,
  jobText: string,
  truncated: boolean,
  coverage: RoleAssessment['coverage'] = 'partial',
): RoleAssessment {
  const seen = new Set<string>();

  if (rows.length < 2 || rows.length > 24) {
    throw new Error('Incomplete alignment evidence');
  }

  for (const row of rows) {
    const identity = `${row.area}:${row.jobQuote.trim().toLowerCase()}`;
    const segment = segments.find((item) => item.line === row.line);

    if (
      !row.jobQuote.trim() ||
      !jobText.includes(row.jobQuote) ||
      seen.has(identity) ||
      (row.status === 'contradicted' && row.rewrite !== null) ||
      (row.status === 'not_evidenced' && row.rewrite !== null) ||
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

    const overlap = selected.filter(
      (row) => row.status === 'supported' || row.status === 'partial',
    ).length;

    const required = selected.filter((row) => row.priority === 'required');

    const requiredGaps = required.filter((row) =>
      ['not_evidenced', 'contradicted'].includes(row.status),
    ).length;

    const incomplete = truncated || coverage === 'partial';

    const distinctLines = new Set(
      selected.filter((row) => row.line !== null).map((row) => row.line),
    ).size;

    if (!selected.length) {
      throw new Error('Incomplete alignment evidence');
    }

    return {
      alignment:
        !requiredGaps && !incomplete && supported === selected.length && selected.length >= 2
          ? 'strong'
          : overlap
            ? 'partial'
            : 'limited',
      confidence:
        !incomplete && supported === selected.length && distinctLines >= 3
          ? 'high'
          : quoted
            ? 'moderate'
            : 'low',
      evidenceCount: selected.length,
      requiredGaps,
      screening: requiredGaps
        ? 'requirements_not_demonstrated'
        : selected.some((row) => row.status !== 'supported')
          ? 'needs_clarification'
          : incomplete || !required.length
            ? 'insufficient_context'
            : 'potential_fit',
    };
  }

  return {
    aiStatus: 'completed',
    ats: area('ats'),
    recruiter: area('recruiter'),
    coverage: truncated ? 'partial' : coverage,
    evidence: rows.map((row) => ({ ...row, rewrite: safeRoleRewrite(row) })),
    limitations: [
      'This screening rehearsal checks stated job requirements against your resume. Employer-specific ATS rules and recruiter decisions are unavailable.',
      'Evidence confidence reflects verified source excerpts. It is not a probability of passing an ATS or recruiter screen.',
      'ATS alignment covers wording and keyword evidence, not file parsing or undisclosed screening rules.',
      'Missing resume evidence does not prove you lack experience. Verify AI suggestions; add only facts you can support.',
      'Required experience or qualifications that are missing or contradicted remain screening gaps. Wording edits cannot satisfy them.',
      'Suggested wording uses the quoted resume facts. Conditional next steps are guidance, not achievements to copy into your resume.',
      ...(coverage === 'partial'
        ? [
            'The model could not cover all identified requirements. This assessment cannot establish screening readiness.',
          ]
        : []),
      ...(truncated
        ? [
            'The job description was shortened for this assessment; confidence is capped at moderate.',
          ]
        : []),
    ],
  };
}

/** Restrict copyable edits to source vocabulary; guidance can request detail separately. */
export function safeRoleRewrite(row: RoleEvidence): string | null {
  if (!row.rewrite || !row.resumeQuote || !['supported', 'partial'].includes(row.status)) {
    return null;
  }

  const words = (text: string): string[] =>
    text.toLowerCase().match(/[\p{L}\p{N}]+(?:[+#]+)?/gu) ?? [];

  const original = new Set(words(row.resumeQuote));
  const proposed = words(row.rewrite);

  const numbers = (text: string): string[] => text.match(/\d+(?:[.,]\d+)?(?:\s?%|\+)?/g) ?? [];

  const sourceNumbers = numbers(row.resumeQuote);
  const editNumbers = numbers(row.rewrite);

  const connectors = new Set(
    'a an the and or with for to of in on by from using through as at into that which is was were are'.split(
      ' ',
    ),
  );

  if (
    proposed.some((word) => !original.has(word) && !connectors.has(word)) ||
    [
      'not',
      'never',
      'no',
      'without',
      'may',
      'might',
      'could',
      'learning',
      'assisted',
      'supported',
      'approximately',
      'about',
      'less',
      'more',
      'under',
      'over',
    ].some((word) => original.has(word) && !proposed.includes(word)) ||
    sourceNumbers.some((value) => !editNumbers.includes(value)) ||
    editNumbers.some((value) => !sourceNumbers.includes(value))
  ) {
    return null;
  }

  return row.rewrite.trim() || null;
}

export function unavailableRoleAssessment(aiStatus: 'failed' | 'unavailable'): RoleAssessment {
  const unknown: AlignmentAssessment = {
    alignment: 'unknown',
    confidence: 'low',
    evidenceCount: 0,
    screening: 'insufficient_context',
    requiredGaps: 0,
  };

  return {
    aiStatus,
    ats: unknown,
    recruiter: unknown,
    evidence: [],
    coverage: 'partial',
    limitations: [
      'AI alignment feedback could not be verified. Your existing qualification comparison remains available.',
    ],
  };
}
