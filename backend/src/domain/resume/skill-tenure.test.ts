import { describe, expect, it } from 'vitest';
import { AnalyzeResume } from '../../application/resume/analyze-resume.js';
import { estimateSkillTenure } from './experience.js';
import type { ResumeEmployment, ResumeSignal } from './model.js';

const analyzer = new AnalyzeResume([], () => new Date('2026-10-01'));

const text =
  'Experience\nOrion Labs — Software Engineer Jan 2020 – Dec 2023\nBuilt services using TypeScript and AWS.\nSkills\nJava';

describe('role-linked skill duration estimates', () => {
  it('estimates four years for direct role usage, without dating a standalone skill or inferred activity', () => {
    const analysis = analyzer.execute({ text });

    expect(analysis.skillTenure).toEqual([]);

    expect(analysis.skillTenureEstimates).toEqual([
      {
        skillId: 'typescript',
        minimumMonths: 48,
        maximumMonths: 48,
        roleIds: [analysis.employment[0]!.id],
      },
      {
        skillId: 'aws',
        minimumMonths: 48,
        maximumMonths: 48,
        roleIds: [analysis.employment[0]!.id],
      },
    ]);
  });

  it('unions overlapping months, and recalculates after employment edits or removal', () => {
    const analysis = analyzer.execute({
      text:
        text.replace('Dec 2023', 'Dec 2022') +
        '\nExperience\nNova Labs — Software Engineer Jan 2022 – Dec 2023\nBuilt services using TypeScript.',
    });

    expect(
      analysis.skillTenureEstimates?.find((entry) => entry.skillId === 'typescript'),
    ).toMatchObject({ minimumMonths: 48, maximumMonths: 48 });

    const corrected = analyzer.execute({
      text,
      corrections: {
        employment: [{ id: analyzer.execute({ text }).employment[0]!.id, end: 'Dec 2021' }],
      },
    });

    expect(corrected.skillTenureEstimates?.[0]).toMatchObject({
      minimumMonths: 24,
      maximumMonths: 24,
    });

    expect(
      analyzer.execute({
        text,
        corrections: {
          employment: [{ id: analyzer.execute({ text }).employment[0]!.id, removed: true }],
        },
      }).skillTenureEstimates,
    ).toEqual([]);

    expect(
      analyzer
        .execute({ text, corrections: { removeSkills: ['typescript'] } })
        .skillTenureEstimates?.map((entry) => entry.skillId),
    ).not.toContain('typescript');
  });

  it('preserves coarse date bounds and excludes invalid dates, projects and internships', () => {
    const analysis = analyzer.execute({ text: text.replace('Jan 2020 – Dec 2023', '2020 – 2023') });

    expect(analysis.skillTenureEstimates?.[0]).toMatchObject({
      minimumMonths: 26,
      maximumMonths: 48,
    });

    const entry = analyzer.execute({ text }).employment[0]!;

    for (const changes of [
      { start: 'unknown' },
      { kind: 'project' as const },
      { kind: 'internship' as const },
    ]) {
      expect(
        estimateSkillTenure(
          analyzer.execute({ text }).skills,
          [{ ...entry, ...changes }],
          '2026-10-01',
        ),
      ).toEqual([]);
    }
  });

  it.each([
    { status: 'learning' },
    { status: 'negated' },
    { interpretation: 'interpreted' },
    { deniedFacets: ['usage'] },
    { deniedFacets: ['general'] },
    { uncertainFacets: ['usage'] },
  ])('never assigns role years to unsupported or denied claims: %j', (changes) => {
    const analysis = analyzer.execute({ text });
    const skill = { ...analysis.skills[0]!, ...changes } as ResumeSignal;

    expect(
      estimateSkillTenure(
        [skill],
        analysis.employment as ResumeEmployment[],
        analysis.analysisDate,
      ),
    ).toEqual([]);
  });
});
