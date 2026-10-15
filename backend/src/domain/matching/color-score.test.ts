import { describe, expect, it } from 'vitest';
import { candidate, featureJob } from '../../test-fixtures/resume-matching.js';
import { compareMatches, scoreJob, scoringVersion } from './score.js';

const compare = (description: string, profile = candidate()) =>
  scoreJob(featureJob(description), profile, [], false);

describe('qualification color scoring', () => {
  it('counts green, yellow and red equally important qualifications as 100%, 25% and 0%', () => {
    const result = compare(
      'Requirements\nTypeScript required.\nJavaScript required.\nDocker required.',
    );

    expect(result.skills.map((item) => item.confidence)).toEqual(['green', 'yellow', 'red']);
    expect(result.fitScore).toBeCloseTo(125 / 3);
    expect(result.assessmentCoverage).toMatchObject({ assessed: 3, total: 3, percentage: 100 });
  });

  it.each(['mentioned', 'learning'] as const)(
    'gives a yellow %s claim 25% regardless of graph credit',
    (status) => {
      const result = compare('Requirements\nTypeScript required.', {
        ...candidate(),
        skills: [{ id: 'typescript', status }],
      });

      expect(result.skills[0]?.confidence).toBe('yellow');
      expect(result.fitScore).toBe(25);
    },
  );

  it('includes every unassessable qualification at 25% without calling it assessed', () => {
    const result = compare(
      'Requirements\nTypeScript required.\nKnowledge of UncataloguedHDL required.',
    );

    expect(result.fitScore).toBe(62.5);
    expect(result.unresolvedRequirements).toBe(1);
    expect(result.assessmentCoverage).toMatchObject({ assessed: 1, total: 2, percentage: 50 });
  });

  it('weights a required qualification three times a preferred qualification', () => {
    expect(
      compare(
        'Requirements\nTypeScript required.\nPreferred qualifications\nKnowledge of UncataloguedHDL preferred.',
      ).fitScore,
    ).toBe(81.25);

    expect(
      compare(
        'Requirements\nKnowledge of UncataloguedHDL required.\nPreferred qualifications\nTypeScript preferred.',
      ).fitScore,
    ).toBe(43.75);
  });

  it('counts repeats once and each OR group once', () => {
    const plain = compare(
      'Requirements\nTypeScript or Kotlin required.\nKnowledge of UncataloguedHDL required.',
    );

    const repeated = compare(
      'Requirements\nTypeScript or Kotlin required.\nTypeScript or Kotlin required.\nKnowledge of UncataloguedHDL required.\nKnowledge of UncataloguedHDL required.',
    );

    expect(plain.fitScore).toBe(62.5);
    expect(repeated.fitScore).toBe(plain.fitScore);
    expect(repeated.assessmentCoverage).toEqual(plain.assessmentCoverage);
  });

  it('keeps unknown OR routes yellow unless a recognized route fully satisfies the group', () => {
    const job = featureJob('Requirements\nTypeScript required.');

    job.requirements.skills[0]!.unresolvedAlternatives = ['UnsupportedTool'];

    expect(scoreJob(job, candidate(), [], false).fitScore).toBe(100);

    const unknown = scoreJob(job, { ...candidate(), skills: [] }, [], false);

    expect(unknown.fitScore).toBe(25);
    expect(unknown.skills[0]?.confidence).toBe('yellow');
    expect(unknown.unresolvedRequirements).toBe(1);
  });

  it('gives red duration gaps zero credit even when the candidate is close to the threshold', () => {
    const result = compare('Requirements\nTypeScript required.\n5 years professional experience.');

    expect(result.experience[0]?.status).toBe('below');
    expect(result.fitScore).toBe(50);
  });

  it('counts uncertain tenure, degree and authorization at 25% each', () => {
    const result = compare(
      'Requirements\nTypeScript required.\n4 years of experience with TypeScript.\nBS in Computer Science required.\nMust be authorized to work in Netherlands.',
    );

    expect(result.fitScore).toBe(43.75);
    expect(result.unresolvedRequirements).toBe(3);
    expect(result.assessmentCoverage).toMatchObject({ assessed: 1, total: 4 });
  });

  it('keeps red education gaps at zero and excludes role, function and incidental location bonuses from fit', () => {
    const profile = {
      ...candidate(),
      education: [
        {
          level: 'bachelor' as const,
          field: 'business' as const,
          completion: 'completed' as const,
        },
      ],
    };

    const result = compare(
      'Requirements\nTypeScript required.\nMS in Computer Science required.\nResponsibilities\nBuild services using Kotlin.',
      profile,
    );

    expect(result.education[0]?.status).toBe('below');
    expect(result.fitScore).toBe(50);
    expect(result.roleRelevancePoints).toBe(5);
    expect(result.baseScore).toBe(55);
  });

  it('does not grant credit to purple suggestions or invent a score for empty or truncated extraction', () => {
    const suggestion = compare('Requirements\nClang required.', {
      ...candidate(),
      skills: [{ id: 'cpp', status: 'user_confirmed' }],
    });

    expect(suggestion.skills[0]?.confidence).toBe('purple');
    expect(suggestion.fitScore).toBe(0);
    expect(compare('We use TypeScript.').fitScore).toBeNull();

    const job = featureJob();

    job.requirements.truncated = true;
    expect(scoreJob(job, candidate(), [], false).fitScore).toBeNull();
    expect(scoringVersion).toBe('score-8:relations-3');
  });

  it('ranks a partial numerical assessment ahead of a fully assessed red result, with unavailable scores last', () => {
    const partial = compare(
      'Requirements\nTypeScript required.\nKnowledge of UncataloguedHDL required.',
    );

    const red = compare('Requirements\nDocker required.');
    const unavailable = compare('We use TypeScript.');

    expect(partial.band).toBe('review');
    expect(red.band).toBe('exploratory');
    expect(compareMatches(partial, red)).toBeLessThan(0);
    expect(compareMatches(red, unavailable)).toBeLessThan(0);
  });
});
