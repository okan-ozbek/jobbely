import { describe, expect, it } from 'vitest';
import { groundedRoleAssessment, safeRoleRewrite } from './role-assessment.js';
import type { RoleEvidence } from './role-assessment.js';

const segments = [{ line: 3, text: 'Built Python services and SQL reports.' }];
const job = 'Python experience. SQL knowledge. Clear contributions.';

const row = (area: RoleEvidence['area'], jobQuote = 'Python experience.'): RoleEvidence => ({
  area,
  status: 'supported',
  priority: 'required',
  jobQuote,
  resumeQuote: 'Built Python services',
  line: 3,
  explanation: 'Python work is stated.',
  suggestion: 'Explain the contribution with factual detail.',
  rewrite: null,
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

    const result = groundedRoleAssessment(rows, distinctSegments, job, false, 'all_identified');

    expect(result.ats).toMatchObject({
      alignment: 'strong',
      confidence: 'high',
      evidenceCount: 3,
      screening: 'potential_fit',
      requiredGaps: 0,
    });

    expect(
      groundedRoleAssessment(rows, distinctSegments, job, true, 'all_identified').ats.confidence,
    ).toBe('moderate');

    expect(
      groundedRoleAssessment(
        rows.map((item) => ({ ...item, line: 3, resumeQuote: segments[0]!.text })),
        segments,
        job,
        false,
        'all_identified',
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

    expect(
      groundedRoleAssessment([missing, row('recruiter')], segments, job, false).ats,
    ).toMatchObject({
      alignment: 'limited',
      confidence: 'low',
      evidenceCount: 1,
      screening: 'requirements_not_demonstrated',
      requiredGaps: 1,
    });
  });

  it('does not let supported keywords outweigh a missing required qualification', () => {
    const rows = [
      row('ats'),
      {
        ...row('ats', 'SQL knowledge.'),
        status: 'not_evidenced' as const,
        resumeQuote: null,
        line: null,
      },
      row('recruiter'),
    ];

    const result = groundedRoleAssessment(rows, segments, job, false, 'all_identified');

    expect(result.ats).toMatchObject({
      screening: 'requirements_not_demonstrated',
      requiredGaps: 1,
      alignment: 'partial',
      confidence: 'moderate',
    });

    expect(result.limitations.join(' ')).toContain('Wording edits cannot satisfy');
  });

  it('flags explicit lower experience as a requirement conflict and never offers a rewrite', () => {
    const rows = [
      {
        ...row('ats'),
        status: 'contradicted' as const,
        resumeQuote: 'Python experience: 1 year.',
        line: 8,
      },
      row('recruiter'),
    ];

    const result = groundedRoleAssessment(
      rows,
      [...segments, { line: 8, text: 'Python experience: 1 year.' }],
      job,
      false,
      'all_identified',
    );

    expect(result.ats.screening).toBe('requirements_not_demonstrated');
    expect(result.ats.alignment).toBe('limited');
    expect(result.evidence[0]!.rewrite).toBeNull();

    expect(() =>
      groundedRoleAssessment(
        [{ ...rows[0]!, rewrite: 'Python experience: 5 years.' }, rows[1]!],
        [...segments, { line: 8, text: 'Python experience: 1 year.' }],
        job,
        false,
      ),
    ).toThrow();
  });

  it('withholds screening readiness when context is partial or no required criteria are identified', () => {
    const rows = [row('ats'), row('recruiter')];

    expect(groundedRoleAssessment(rows, segments, job, false, 'partial').ats.screening).toBe(
      'insufficient_context',
    );

    expect(
      groundedRoleAssessment(
        rows.map((item) => ({ ...item, priority: 'preferred' })),
        segments,
        job,
        false,
        'all_identified',
      ).ats.screening,
    ).toBe('insufficient_context');
  });

  it('separates partial experience from unsupported required evidence and preferences', () => {
    expect(
      groundedRoleAssessment(
        [{ ...row('ats'), status: 'partial' }, row('recruiter')],
        segments,
        job,
        false,
        'all_identified',
      ).ats.screening,
    ).toBe('needs_clarification');

    const preference = {
      ...row('ats', 'SQL knowledge.'),
      priority: 'preferred' as const,
      status: 'not_evidenced' as const,
      resumeQuote: null,
      line: null,
    };

    expect(
      groundedRoleAssessment(
        [row('ats'), preference, row('recruiter')],
        segments,
        job,
        false,
        'all_identified',
      ).ats.requiredGaps,
    ).toBe(0);
  });

  it('keeps grounded wording edits but removes new claims, numbers, units and lost uncertainty', () => {
    expect(safeRoleRewrite({ ...row('ats'), rewrite: 'Built services using Python.' })).toBe(
      'Built services using Python.',
    );

    for (const rewrite of [
      'Built Python services using Kubernetes.',
      'Led Python services.',
      'Built Python services with 50 users.',
    ]) {
      expect(safeRoleRewrite({ ...row('ats'), rewrite })).toBeNull();
    }

    expect(
      safeRoleRewrite({
        ...row('ats'),
        resumeQuote: 'Learning Python, not production experience.',
        rewrite: 'Python production experience.',
      }),
    ).toBeNull();

    expect(
      safeRoleRewrite({
        ...row('ats'),
        resumeQuote: 'Assisted with Python services.',
        rewrite: 'Python services.',
      }),
    ).toBeNull();

    expect(
      safeRoleRewrite({
        ...row('ats'),
        resumeQuote: 'Improved latency by 20%.',
        rewrite: 'Improved latency by 20.',
      }),
    ).toBeNull();

    expect(
      safeRoleRewrite({
        ...row('ats'),
        resumeQuote: 'Python for about 1 year.',
        rewrite: 'Python for 1 year.',
      }),
    ).toBeNull();
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
