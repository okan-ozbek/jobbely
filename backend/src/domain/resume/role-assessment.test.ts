import { describe, expect, it } from 'vitest';
import { groundedRoleAssessment } from './role-assessment.js';
import type { RoleEvidence } from './role-assessment.js';

const segments = [{ line: 3, text: 'Built Python services and SQL reports.' }];
const job = 'Python experience. SQL knowledge. Clear contributions.';

const row = (area: RoleEvidence['area'], jobQuote = 'Python experience.'): RoleEvidence => ({
  area,
  status: 'supported',
  jobQuote,
  resumeQuote: 'Built Python services',
  line: 3,
  explanation: 'Python work is stated.',
  suggestion: 'Explain the contribution with factual detail.',
});

describe('grounded role alignment', () => {
  it('derives qualitative confidence from distinct verified excerpts, not pass probabilities', () => {
    const distinctSegments = [
      ...segments,
      { line: 4, text: 'Developed SQL reports.' },
      { line: 5, text: 'Documented service contributions.' },
    ];

    const rows = (['ats', 'recruiter'] as const).flatMap((area) =>
      ['Python experience.', 'SQL knowledge.', 'Clear contributions.'].map((quote, index) => ({
        ...row(area, quote),
        line: 3 + index,
        resumeQuote: distinctSegments[index]!.text,
      })),
    );

    const result = groundedRoleAssessment(rows, distinctSegments, job, false);

    expect(result.ats).toEqual({ alignment: 'strong', confidence: 'high', evidenceCount: 3 });

    expect(groundedRoleAssessment(rows, distinctSegments, job, true).ats.confidence).toBe(
      'moderate',
    );

    expect(
      groundedRoleAssessment(
        rows.map((item) => ({ ...item, line: 3, resumeQuote: segments[0]!.text })),
        segments,
        job,
        false,
      ).ats.confidence,
    ).toBe('moderate');

    expect(result.limitations.join(' ')).toContain('not a probability');
  });

  it('keeps missing evidence separate from lacking the qualification', () => {
    const missing: RoleEvidence = {
      ...row('ats'),
      status: 'not_evidenced',
      resumeQuote: null,
      line: null,
    };

    expect(groundedRoleAssessment([missing, row('recruiter')], segments, job, false).ats).toEqual({
      alignment: 'limited',
      confidence: 'low',
      evidenceCount: 1,
    });
  });

  it.each([
    [row('ats'), { ...row('recruiter'), jobQuote: 'Invented requirement' }],
    [row('ats'), { ...row('recruiter'), line: 100 }],
    [row('ats'), { ...row('recruiter'), resumeQuote: 'Built Rust services' }],
    [row('ats'), row('ats')],
    [row('ats'), { ...row('recruiter'), status: 'not_evidenced' as const }],
    [row('ats')],
  ])('rejects invalid, duplicated or incomplete evidence: %j', (...rows) => {
    expect(() => groundedRoleAssessment(rows, segments, job, false)).toThrow();
  });
});
