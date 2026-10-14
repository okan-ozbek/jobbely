import { describe, expect, it } from 'vitest';
import { reviewRules, writingSegments, verifiedAiFindings } from './review.js';
import type { ResumeReviewInput, AiReviewFinding } from './review.js';

const input: ResumeReviewInput = {
  text: 'Synthetic Candidate\nsynthetic@example.invalid\n+31 612345678\nExperience\nEngineer | Fictional Labs\n2020 - 2024\n- Built a reporting service for 12 teams.',
  aiConsent: false,
  language: 'en-GB',
  targetCountry: 'Netherlands',
  jobDescription: '',
};

describe('resume reviewer rules and evidence', () => {
  it('does not manufacture issues for a clear conventional resume', () => {
    expect(reviewRules(input)).toEqual([]);
  });

  it('distinguishes missing contact information from a definite error', () => {
    const findings = reviewRules({
      ...input,
      text: 'Synthetic Candidate\nExperience\nEngineer | Fictional Labs',
    });

    expect(findings.map((finding) => [finding.id, finding.severity])).toEqual([
      ['contact-email', 'risk'],
      ['contact-phone', 'suggestion'],
    ]);
  });

  it('finds reversed dates and duplicate bullets with exact source lines', () => {
    const text = `${input.text.replace('2020 - 2024', '2024 - 2020')}\n- Built a reporting service for 12 teams.`;
    const findings = reviewRules({ ...input, text });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', quote: '2024 - 2020', line: 6 }),
        expect.objectContaining({ category: 'clarity', line: 8 }),
      ]),
    );
  });

  it('treats detected layout as a risk, not an ATS rejection verdict', () => {
    const findings = reviewRules({
      ...input,
      layout: {
        format: 'pdf',
        pages: 2,
        columnPages: [2],
        smallTextPages: [1],
        tableRows: 1,
        contactInHeaderFooter: true,
      },
    });

    expect(findings).toHaveLength(4);
    expect(findings[0]).toMatchObject({ page: 2, severity: 'risk' });
    expect(findings.some((finding) => finding.severity === 'error')).toBe(false);
  });

  it('does not penalize gaps, photos, education dates or one versus two pages', () => {
    expect(
      reviewRules({
        ...input,
        text: `${input.text}\nEducation\nDegree completed 2010\nCareer break 2015 - 2018\nPhoto included`,
        layout: {
          format: 'pdf',
          pages: 2,
          columnPages: [],
          smallTextPages: [],
          tableRows: 0,
          contactInHeaderFooter: false,
        },
      }),
    ).toEqual([]);
  });

  it('minimizes obvious contact data while preserving dated experience and line numbers', () => {
    const segments = writingSegments(
      `${input.text}\nLocation: Amsterdam\nhttps://example.invalid/profile`,
    );

    expect(segments).toContainEqual({ line: 6, text: '2020 - 2024' });
    expect(JSON.stringify(segments)).not.toMatch(/Synthetic Candidate|@|612345678|Amsterdam|https/);
  });

  it('rejects fabricated quotes, incorrect line associations and new numerical claims', () => {
    const segments = writingSegments(input.text);

    const finding: AiReviewFinding = {
      category: 'clarity',
      title: 'Clarify the outcome',
      explanation: 'Add context.',
      suggestion: 'Explain the benefit if known.',
      quote: 'Built a reporting service for 12 teams.',
      line: 7,
      rewrite: null,
    };

    expect(verifiedAiFindings([finding], segments)[0]).toMatchObject({
      source: 'ai',
      severity: 'suggestion',
      line: 7,
    });

    expect(() =>
      verifiedAiFindings([{ ...finding, quote: 'Invented experience' }], segments),
    ).toThrow();

    expect(() => verifiedAiFindings([{ ...finding, line: 6 }], segments)).toThrow();

    expect(() =>
      verifiedAiFindings([{ ...finding, rewrite: 'Improved productivity by 50%.' }], segments),
    ).toThrow();
  });

  it.each([' ', 'x'.repeat(40_001), 'x\n'.repeat(2_001), 'x\r'.repeat(2_001)])(
    'rejects empty or unbounded input',
    (text) => {
      expect(() => reviewRules({ ...input, text })).toThrow();
    },
  );
});
