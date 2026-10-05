import { describe, expect, it } from 'vitest';
import { AnalyzeResume } from '../../application/resume/analyze-resume.js';
import { degreeMentions } from './qualifications.js';

describe('explicit education and skill duration claims', () => {
  it('keeps separate subjects and completion on a shared line and never completes a negated degree', () => {
    const result = new AnalyzeResume([], () => new Date('2026-10-01')).execute({
      text: 'Education\nBS in Computer Science 2015; Masters in Mathematics expected 2027\nNo BA in Business.',
    });

    expect(result.education).toEqual([
      { level: 'bachelor', field: 'computer-science', completion: 'completed' },
      { level: 'master', field: 'mathematics', completion: 'in-progress' },
      { level: 'bachelor', field: 'business', completion: 'unknown' },
    ]);
  });

  it.each(['BS', 'BSc', 'BA', 'Bachelor', 'Bachelor’s', 'B.Sc.', 'B.A.'])(
    'recognizes bachelor alias %s',
    (alias) => {
      expect(degreeMentions(`${alias} in Computer Science`)[0]?.level).toBe('bachelor');
    },
  );

  it.each(['MS', 'MSc', 'MA', 'Masters', 'Master’s', 'M.Sc.', 'M.A.'])(
    'recognizes master alias %s',
    (alias) => {
      expect(degreeMentions(`${alias} in Computer Science`)[0]?.level).toBe('master');
    },
  );

  it('keeps explicit duration claims separate from role estimates and related skills', () => {
    const result = new AnalyzeResume([], () => new Date('2026-10-01')).execute({
      text: 'Summary\n8 years of experience with Java.\nExperience\nOrion Labs — Software Engineer Jan 2016 – Dec 2025\nBuilt C++ services and Redis pipelines.\nEducation\nBSc in Computer Science 2015\nMasters in Mathematics expected 2027',
    });

    expect(result.education).toEqual([
      { level: 'bachelor', field: 'computer-science', completion: 'completed' },
      { level: 'master', field: 'mathematics', completion: 'in-progress' },
    ]);

    expect(result.skillTenure).toEqual([{ skillId: 'java', months: 96 }]);

    expect(result.skillTenureEstimates).toEqual([
      expect.objectContaining({ skillId: 'cpp', minimumMonths: 120, maximumMonths: 120 }),
      expect.objectContaining({ skillId: 'redis', minimumMonths: 120, maximumMonths: 120 }),
    ]);
  });

  it('does not accept ambiguous multi-tool duration claims or lower-case latency units', () => {
    const result = new AnalyzeResume([]).execute({
      text: 'Summary\n5 years of experience with Java or Python.\nLatency is 10 ms.\nEducation\nStudying BA in Business.',
    });

    expect(result.skillTenure).toEqual([]);

    expect(result.education).toEqual([
      { level: 'bachelor', field: 'business', completion: 'in-progress' },
    ]);

    expect(degreeMentions('10 ms latency')).toEqual([]);
  });
});
