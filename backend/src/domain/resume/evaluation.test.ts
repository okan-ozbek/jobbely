import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AnalyzeResume, ResumeInputError } from '../../application/resume/analyze-resume.js';
import { loadRegistry } from '../../infrastructure/registry.js';
import { dateBounds, experienceRange } from './experience.js';
import type { ResumeEmployment } from './model.js';

interface Fixture {
  id: string;
  text: string;
  expected: {
    skills: string[];
    absentSkills?: string[];
    skillStatuses?: Record<string, string>;
    competencies: string[];
    employers: string[];
    recognized: (string | null)[];
    location: string;
    professional: [number, number];
    internships: [number, number];
    unknownEntries?: number;
  };
}

const fixtures = JSON.parse(
  readFileSync(
    new URL('../../../../frontend/public/resume-evaluation.json', import.meta.url),
    'utf8',
  ),
) as { analysisDate: string; resumes: Fixture[] };

const analyzer = new AnalyzeResume(
  loadRegistry().companies,
  () => new Date('2026-10-01T00:00:00Z'),
);

describe('synthetic resume evaluation corpus', () => {
  for (const fixture of fixtures.resumes) {
    it(fixture.id, () => {
      const result = analyzer.execute({ text: fixture.text, analysisDate: fixtures.analysisDate });
      const expected = fixture.expected;

      expect(result.skills.map((skill) => skill.id).sort()).toEqual([...expected.skills].sort());

      expect(result.competencies.map((competency) => competency.id).sort()).toEqual(
        [...expected.competencies].sort(),
      );

      expect(result.employment.map((entry) => entry.employer)).toEqual(expected.employers);

      expect(result.employment.map((entry) => entry.recognizedCompany)).toEqual(
        expected.recognized,
      );

      expect(result.location.value).toBe(expected.location);

      expect([
        result.experience.professional.minimumMonths,
        result.experience.professional.maximumMonths,
      ]).toEqual(expected.professional);

      expect([
        result.experience.internships.minimumMonths,
        result.experience.internships.maximumMonths,
      ]).toEqual(expected.internships);

      for (const [id, status] of Object.entries(expected.skillStatuses ?? {})) {
        expect(result.skills.find((skill) => skill.id === id)?.status).toBe(status);
      }

      for (const id of expected.absentSkills ?? []) {
        expect(result.skills.some((skill) => skill.id === id)).toBe(false);
      }

      if (expected.unknownEntries !== undefined) {
        expect(result.experience.professional.unknownEntries).toBe(expected.unknownEntries);
      }

      for (const line of result.document.lines) {
        expect(result.document.text.slice(line.start, line.end)).toBe(line.text);
      }
    });
  }

  it('recalculates edited dates without mutating the original reading evidence', () => {
    const text = fixtures.resumes[0]!.text;
    const before = analyzer.execute({ text });
    const entry = before.employment[1]!;

    const after = analyzer.execute({
      text,
      corrections: {
        employment: [{ id: entry.id, end: 'Dec 2024', employer: 'Microsoft' }],
        location: 'Berlin, Germany',
        addSkills: ['Kotlin'],
        removeSkills: ['docker'],
      },
    });

    expect(after.experience.professional.minimumMonths).toBe(60);

    expect(after.employment.find((item) => item.id === entry.id)).toMatchObject({
      recognizedCompany: 'microsoft',
      status: 'user_confirmed',
      evidence: entry.evidence,
    });

    expect(after.document).toEqual(before.document);
    expect(after.location.status).toBe('user_confirmed');

    expect(after.skills.find((skill) => skill.name === 'Kotlin')).toMatchObject({
      status: 'user_confirmed',
      evidence: [],
    });

    expect(after.skills.some((skill) => skill.id === 'docker')).toBe(false);
  });

  it('supports manual roles and removing extracted roles without assuming missing years', () => {
    const result = analyzer.execute({
      text: 'Skills\nPython',
      corrections: {
        employment: [
          {
            id: 'manual-1',
            employer: 'Local Studio',
            title: 'Developer',
            category: 'engineering',
            start: 'Jan 2020',
            end: 'Dec 2020',
          },
        ],
      },
    });

    expect(result.experience.professional.minimumMonths).toBe(12);
    expect(result.employment[0]?.recognizedCompany).toBeNull();

    expect(() =>
      analyzer.execute({
        text: 'Skills\nPython',
        corrections: { employment: [{ id: 'invented' }] },
      }),
    ).toThrow(ResumeInputError);
  });

  it('bounds resource-heavy text, rejects whitespace and invalid analysis dates', () => {
    for (const text of [' ', 'a'.repeat(100_001), 'a'.repeat(2_001), '\n'.repeat(2_001)]) {
      expect(() => analyzer.execute({ text })).toThrow(ResumeInputError);
    }

    for (const analysisDate of ['2026-02-30', '2027-01-01', 'invalid']) {
      expect(() => analyzer.execute({ text: 'Skills\nPython', analysisDate })).toThrow(
        ResumeInputError,
      );
    }
  });

  it('keeps education dates out of employment and suppresses unsupported competency guesses', () => {
    const result = analyzer.execute({
      text: 'Education\nLeadership Academy\n2010 - 2014\nSkills\nLeadership, communication, JavaScript',
    });

    expect(result.employment).toEqual([]);
    expect(result.competencies).toEqual([]);
    expect(result.skills.map((skill) => skill.id)).toEqual(['javascript']);
  });

  it('deduplicates repeated skill claims and bounds evidence without inventing skill tenure', () => {
    const result = analyzer.execute({ text: `Skills\n${'TypeScript\n'.repeat(100)}` });

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.evidence).toHaveLength(5);
    expect(result.experience.professional.minimumMonths).toBe(0);
  });
});

describe('duration bounds', () => {
  it('does not turn employment at a tool vendor into proficiency with that tool', () => {
    const text =
      'Experience\nProduct Manager | Figma\nJan 2020 - Dec 2020\nSales Manager | Salesforce\nJan 2021 - Dec 2021';

    const result = analyzer.execute({ text });

    expect(result.skills).toEqual([]);

    expect(result.employment.map((entry) => entry.recognizedCompany)).toEqual([
      'figma',
      'salesforce',
    ]);

    expect(
      analyzer.execute({
        text,
        corrections: { employment: [{ id: result.employment[0]!.id, removed: true }] },
      }).skills,
    ).toEqual([]);
  });

  it('retains evidence for a stronger claim even after the evidence sample fills', () => {
    const result = analyzer.execute({
      text: `Skills\n${'No experience with Python\n'.repeat(10)}Experience\nDeveloper | Example\nJan 2020 - Dec 2020\nBuilt services using Python.`,
    });

    expect(result.skills[0]?.status).toBe('work_evidenced');

    expect(
      result.skills[0]?.evidence.some((item) => item.excerpt === 'Built services using Python.'),
    ).toBe(true);
  });

  it('normalizes manually confirmed aliases without duplicating the concept', () => {
    const result = analyzer.execute({
      text: 'Skills\nPostgreSQL',
      corrections: { addSkills: ['Postgres'] },
    });

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]).toMatchObject({ id: 'postgresql', status: 'user_confirmed' });
  });

  it('clips ongoing work to the fixed analysis month and rejects future or unsupported dates', () => {
    expect(dateBounds('Present', true, '2026-10-01')).toEqual(
      dateBounds('Sep 2026', true, '2026-10-01'),
    );

    expect(dateBounds('Nov 2026', false, '2026-10-01')).toBeNull();
    expect(dateBounds('13/2020', false, '2026-10-01')).toBeNull();
  });

  it('never double-counts nested or adjacent employment intervals', () => {
    const base: ResumeEmployment = {
      id: '1',
      employer: 'Example',
      title: 'Developer',
      recognizedCompany: null,
      category: 'engineering',
      kind: 'employment',
      relationship: 'unknown',
      start: '',
      end: '',
      status: 'extracted',
      evidence: [],
    };

    const entries = [
      { ...base, start: 'Jan 2020', end: 'Dec 2023' },
      { ...base, start: 'Jan 2021', end: 'Dec 2022' },
      { ...base, start: 'Jan 2024', end: 'Dec 2024' },
    ];

    expect(experienceRange(entries, '2026-10-01')).toEqual({
      minimumMonths: 60,
      maximumMonths: 60,
      unknownEntries: 0,
    });
  });
});
