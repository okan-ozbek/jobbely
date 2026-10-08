import { describe, expect, it } from 'vitest';
import { candidate, featureJob } from '../../test-fixtures/resume-matching.js';
import { compareMatches, scoreJob } from './score.js';

const compare = (description: string, profile = candidate()) =>
  scoreJob(featureJob(description), profile, [], false);

describe('identified requirement assessment coverage', () => {
  it('counts a required OR group once and treats missing evidence as assessed, not matched', () => {
    const result = compare(
      'Requirements\nJava or Kotlin required.\nPreferred qualifications\nDocker',
    );

    expect(result.assessmentCoverage).toEqual({
      assessed: 2,
      total: 2,
      percentage: 100,
      limited: false,
    });

    expect(result.skills[1]?.status).toBe('not_evidenced');
    expect(result.baseScore).toBeLessThan(100);
  });

  it('does not let repeated skills, contextual skills, function or location inflate coverage', () => {
    const result = compare(
      'Requirements\nTypeScript required.\nTypeScript required.\nKnowledge of UncataloguedHDL required.\nResponsibilities\nBuild services with Kotlin.',
    );

    expect(result.assessmentCoverage).toMatchObject({ assessed: 1, total: 2, percentage: 50 });
    expect(result.unresolvedRequirements).toBe(1);
    expect(result.band).toBe('review');

    const profile = {
      ...candidate(),
      employment: [],
      location: { value: '', status: 'unknown' as const },
    };

    expect(
      compare('Requirements\nTypeScript required.\nKnowledge of UncataloguedHDL required.', profile)
        .assessmentCoverage,
    ).toEqual(result.assessmentCoverage);
  });

  it('counts uncertain tenure, education and authorization individually without credit from location overlap', () => {
    const result = compare(
      'Requirements\nTypeScript required.\n4 years of experience with TypeScript.\nBS in Computer Science required.\nMust be authorized to work in Netherlands.',
    );

    expect(result.assessmentCoverage).toMatchObject({ assessed: 1, total: 4, percentage: 25 });
    expect(result.unresolvedRequirements).toBe(3);

    const profile = {
      ...candidate(),
      skillTenure: [{ skillId: 'typescript', months: 12 }],
      education: [
        {
          level: 'bachelor' as const,
          field: 'computer-science' as const,
          completion: 'completed' as const,
        },
      ],
    };

    const reviewed = compare(
      'Requirements\nTypeScript required.\n4 years of experience with TypeScript.\nBS in Computer Science required.\nMust be authorized to work in Netherlands.',
      profile,
    );

    expect(reviewed.assessmentCoverage).toMatchObject({ assessed: 3, total: 4, percentage: 75 });
    expect(reviewed.requiredGaps).toBeGreaterThan(0);
    expect(reviewed.band).toBe('review');
  });

  it('leaves unknown alternatives unassessed unless a known alternative fully meets the group', () => {
    const job = featureJob('Requirements\nTypeScript required.');

    job.requirements.skills[0]!.unresolvedAlternatives = ['UnsupportedTool'];

    const known = scoreJob(job, candidate(), [], false);
    const unknown = scoreJob(job, { ...candidate(), skills: [] }, [], false);

    expect(known.assessmentCoverage.percentage).toBe(100);
    expect(unknown.assessmentCoverage).toMatchObject({ assessed: 0, total: 1, percentage: 0 });
    expect(unknown.unresolvedRequirements).toBe(1);
    expect(unknown.band).toBe('review');
  });

  it('does not show a coverage percentage for no identified criteria or truncated extraction', () => {
    expect(compare('We use Python.').assessmentCoverage).toMatchObject({
      total: 0,
      percentage: null,
    });

    const job = featureJob('Requirements\nTypeScript required.');

    job.requirements.truncated = true;

    expect(scoreJob(job, candidate(), [], false)).toMatchObject({
      band: 'review',
      assessmentCoverage: { assessed: 1, total: 1, percentage: null, limited: true },
    });
  });

  it('does not reduce coverage for qualifications that the job never asked for', () => {
    expect(compare('Requirements\nTypeScript required.')).toMatchObject({
      band: 'strong',
      assessmentCoverage: { assessed: 1, total: 1, percentage: 100 },
    });
  });
});

describe('qualification-weighted ranking', () => {
  it('includes unknowns once in fit without an additional coverage penalty', () => {
    const sparse = compare(
      'Requirements\nTypeScript required.\nKnowledge of UncataloguedHDL required.',
    );

    const broader = compare(
      'Requirements\nTypeScript required.\nKnowledge of UncataloguedHDL required.\nPreferred qualifications\nDocker',
    );

    expect(sparse.band).toBe('review');
    expect(broader.band).toBe('review');
    expect(sparse.baseScore).toBe(62.5);
    expect(broader.baseScore).toBeLessThan(sparse.baseScore);
    expect(compareMatches(sparse, broader)).toBeLessThan(0);
    expect(compareMatches(broader, sparse)).toBeGreaterThan(0);
  });

  it('orders weighted fit ahead of the legacy review band while preserving deterministic ties', () => {
    const stronger = compare('Requirements\nTypeScript required.');
    const gaps = compare('Requirements\nDocker required.');

    const review = compare(
      'Requirements\nTypeScript required.\nKnowledge of UncataloguedHDL required.',
    );

    expect(compareMatches(stronger, gaps)).toBeLessThan(0);
    expect(compareMatches(review, gaps)).toBeLessThan(0);
    expect(compareMatches(stronger, stronger)).toBe(0);
  });
});
