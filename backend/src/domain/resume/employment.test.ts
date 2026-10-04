import { describe, expect, it } from 'vitest';
import { AnalyzeResume } from '../../application/resume/analyze-resume.js';

const analyzer = new AnalyzeResume([], () => new Date('2026-10-01T00:00:00Z'));

describe('employment headers and date association', () => {
  it('separates schedule qualifiers from titles and defaults ordinary roles to direct employment', () => {
    const result = analyzer.execute({
      text: [
        'Experience',
        'Fictional Labs — Software Engineer, Full-time Jan 2020 - Dec 2021',
        'Pine Studio — Freelance Software Engineer Jan 2022 - Dec 2022',
        'Copper Systems',
        'Full Stack Engineer (Part-time)',
        'Jan 2023 - Dec 2023',
        'Violet Labs — Contract Software Engineer Jan 2024 - Dec 2024',
      ].join('\n'),
    });

    expect(result.employment.map(({ title, relationship }) => ({ title, relationship }))).toEqual([
      { title: 'Software Engineer', relationship: 'direct' },
      { title: 'Freelance Software Engineer', relationship: 'client' },
      { title: 'Full Stack Engineer', relationship: 'direct' },
      { title: 'Contract Software Engineer', relationship: 'client' },
    ]);

    expect(result.employment[0]!.evidence[0]!.excerpt).toContain('Full-time');
  });

  it('reads six inline roles across a page continuation and unions concurrent work', () => {
    const result = analyzer.execute({
      text: [
        'Professional Experience',
        'Orion Media - Software Engineer February 2026 - Present',
        'London, United Kingdom | Full-time',
        'Built services using TypeScript.',
        'Pine Studio - Freelance Software Engineer March 2024 - Present',
        'Project-based client engagements, primarily part-time',
        'Delivered client systems and mentored peers.',
        'Violet Labs - Technical Co-founder April 2025 - January 2026',
        'Led platform architecture and releases.',
        'Copper Systems - Software Engineer July 2023 - July 2024',
        'Built asynchronous integrations.',
        'Atlas The Platform Engineer - Software Engineer March 2022 - July 2023',
        'Refactored services to improve reliability.',
        'improving maintainability and developer onboarding as services migrated.',
        'Birch Technologies - Software Engineer April 2020 - March 2022',
        'Built device integrations.',
        'Education',
        'Fictional University 2019',
      ].join('\n'),
    });

    expect(result.employment.map(({ employer }) => employer)).toEqual([
      'Orion Media',
      'Pine Studio',
      'Violet Labs',
      'Copper Systems',
      'Atlas The Platform Engineer',
      'Birch Technologies',
    ]);

    expect(result.employment.every((role) => role.category === 'engineering')).toBe(true);
    expect(result.employment.every((role) => role.status === 'extracted')).toBe(true);

    expect(result.experience.professional).toEqual({
      minimumMonths: 78,
      maximumMonths: 78,
      unknownEntries: 0,
    });

    expect(result.warnings).toEqual([]);
  });

  it.each(['-', '–', '—', '|', '@', 'at'])('accepts %s between company and title', (separator) => {
    const result = analyzer.execute({
      text: `Experience\nDelta-Systems ${separator} Senior SWE Jan 2020 - Dec 2021`,
    });

    expect(result.employment[0]).toMatchObject({
      employer: 'Delta-Systems',
      title: 'Senior SWE',
      category: 'engineering',
      start: 'Jan 2020',
      end: 'Dec 2021',
    });
  });

  it('preserves every line of a multiline header as evidence', () => {
    const result = analyzer.execute({
      text: 'Experience\nFictional Labs\nSenior Software Engineer\nJan 2020 - Dec 2021',
    });

    expect(result.employment[0]).toMatchObject({
      employer: 'Fictional Labs',
      title: 'Senior Software Engineer',
    });

    expect(result.employment[0]!.evidence.map(({ lineId }) => lineId)).toEqual([
      'line-2',
      'line-3',
      'line-4',
    ]);
  });

  it('supports a title and dates on one line after the employer', () => {
    const result = analyzer.execute({
      text: 'Experience\nFictional Labs\nSenior SDE Jan 2020 - Dec 2021',
    });

    expect(result.employment[0]).toMatchObject({
      employer: 'Fictional Labs',
      title: 'Senior SDE',
      category: 'engineering',
    });

    expect(result.experience.professional.minimumMonths).toBe(24);
  });

  it('never pairs a date with wrapped responsibility prose and warns about incomplete extraction', () => {
    const result = analyzer.execute({
      text: 'Experience\nimproving maintainability and developer onboarding as services migrated\nperformance-critical paths.\nApril 2020 - March 2022',
    });

    expect(result.employment).toEqual([]);
    expect(result.warnings.join(' ')).toContain('1 dated experience line(s)');
  });

  it('keeps a missing-date role when the following dated line belongs to another role', () => {
    const result = analyzer.execute({
      text: 'Experience\nDeveloper | Fictional Labs\nPine Studio - Developer Jan 2020 - Dec 2021',
    });

    expect(result.employment).toHaveLength(2);
    expect(result.employment[0]!.status).toBe('uncertain');

    expect(result.experience.professional).toEqual({
      minimumMonths: 24,
      maximumMonths: 24,
      unknownEntries: 1,
    });
  });

  it('keeps generic founders unclassified and technical founders in engineering', () => {
    const result = analyzer.execute({
      text: 'Experience\nPine Studio - Founder Jan 2020 - Dec 2021\nOrion Media - Technical Cofounder Jan 2022 - Dec 2023',
    });

    expect(result.employment.map(({ category }) => category)).toEqual([
      'unclassified',
      'engineering',
    ]);
  });
});
