import { describe, expect, it } from 'vitest';
import { scoreJob } from './score.js';
import type { MatchProfile } from './model.js';
import { candidate, featureJob } from '../../test-fixtures/resume-matching.js';
import { readFileSync } from 'node:fs';

const employers = [{ slug: 'meta', name: 'Meta' }];

describe('evidence-backed requirement extraction', () => {
  it('replays the human-annotated public engineering/data job examples', () => {
    const corpus = JSON.parse(
      readFileSync(
        new URL('../../../../frontend/public/resume-evaluation.json', import.meta.url),
        'utf8',
      ),
    ) as {
      jobs: {
        description: string;
        expected: {
          requiredAlternatives?: string[][];
          preferred?: string[];
          contextual?: string[];
          minimumRelevantYears?: number;
        };
      }[];
    };

    for (const sample of corpus.jobs.slice(0, 2)) {
      const requirements = featureJob(sample.description).requirements;

      expect(
        requirements.skills
          .filter((group) => group.importance === 'required')
          .map((group) => group.alternatives.map((item) => item.id)),
      ).toEqual(sample.expected.requiredAlternatives);

      expect(requirements.experience[0]!.minimumMonths).toBe(
        sample.expected.minimumRelevantYears! * 12,
      );

      if (sample.expected.preferred) {
        expect(
          requirements.skills
            .filter((group) => group.importance === 'preferred')
            .flatMap((group) => group.alternatives.map((item) => item.id)),
        ).toEqual(sample.expected.preferred);
      }

      if (sample.expected.contextual) {
        expect(
          requirements.skills
            .filter((group) => group.importance === 'contextual')
            .flatMap((group) => group.alternatives.map((item) => item.id)),
        ).toEqual(sample.expected.contextual);
      }
    }
  });

  it('counts Java or Kotlin as one alternative and keeps stack mentions contextual', () => {
    const job = featureJob(
      'We use Python.\nRequirements\nJava or Kotlin required.\nPreferred qualifications\nDocker\nResponsibilities\nWe use React.',
    );

    expect(
      job.requirements.skills.map((group) => [
        group.importance,
        group.alternatives.map((skill) => skill.id),
      ]),
    ).toEqual([
      ['contextual', ['python']],
      ['required', ['java', 'kotlin']],
      ['preferred', ['docker']],
      ['contextual', ['react']],
    ]);

    expect(scoreJob(job, candidate(), employers, false)).toMatchObject({
      requiredGaps: 0,
      skills: [
        { names: ['Java', 'Kotlin'], status: 'matched', matchedId: 'kotlin' },
        { status: 'not_evidenced', importance: 'preferred' },
        { importance: 'contextual', names: ['React'] },
      ],
    });
  });

  it.each([
    ['engineering', 'TypeScript', 'typescript'],
    ['data-ai', 'dbt', 'dbt'],
    ['product', 'product strategy', 'product-strategy'],
    ['sales', 'prospecting', 'sales-prospecting'],
    ['people', 'employee relations', 'employee-relations'],
  ])('evaluates %s independently', (category, skill, id) => {
    const profile = candidate();

    profile.employment[0]!.category = category as MatchProfile['employment'][number]['category'];
    profile.skills = [{ id, status: 'user_confirmed' }];

    expect(
      scoreJob(
        featureJob(`Requirements\n${skill} required.\n2 years of experience.`, category),
        profile,
        employers,
        false,
      ),
    ).toMatchObject({ band: 'strong', requiredGaps: 0, experience: [{ status: 'met' }] });
  });

  it('does not turn compensation bonuses into preferred candidate requirements', () => {
    const result = featureJob(
      'Preferred qualifications\nDocker\nIn addition, Fictional Labs offers equity, bonus, and benefits, including health insurance and paid leave.',
    ).requirements;

    expect(result.skills[0]!.importance).toBe('preferred');
    expect(result.unparsed).toEqual([]);
  });

  it('preserves required experience and preferred skill statements under their headings', () => {
    const result = featureJob(
      'Role Details:\nBuild services with TypeScript.\nExperience:\n6+ years of experience building web applications.\nDeep expertise in TypeScript.\nNice to Haves:\nExperience with PostgreSQL, Docker, and Kubernetes.\nEducation and Training:\nA degree or equivalent industry experience.',
    ).requirements;

    expect(result.experience[0]).toMatchObject({ minimumMonths: 72, importance: 'required' });

    expect(
      result.skills.find((group) => group.importance === 'required')!.alternatives[0]!.id,
    ).toBe('typescript');

    expect(
      result.skills
        .filter((group) => group.importance === 'preferred')
        .flatMap((group) => group.alternatives.map((skill) => skill.id)),
    ).toEqual(['postgresql', 'docker', 'kubernetes']);

    expect(result.constraints[0]).toMatchObject({ kind: 'qualification', importance: 'required' });
  });

  it('preserves skill-specific tenure, alternatives and location/authorization evidence', () => {
    const job = featureJob(
      'Requirements\n4 years of experience with Python.\nRemote only within Germany.\nMust be authorized to work in Germany.\nA degree or equivalent experience.',
    );

    expect(job.requirements.experience[0]).toMatchObject({
      scope: 'skill',
      skillId: 'python',
      minimumMonths: 48,
    });

    expect(job.requirements.constraints.map((item) => item.kind)).toEqual([
      'location',
      'authorization',
      'qualification',
    ]);

    expect(scoreJob(job, candidate(), employers, false)).toMatchObject({
      band: 'review',
      experience: [{ status: 'uncertain' }],
    });
  });

  it('does not count all engineering years as years managing a team', () => {
    const result = scoreJob(
      featureJob(
        'Requirements\n3+ years of experience in managing and leading teams.\nTypeScript required.',
      ),
      candidate(),
      employers,
      false,
    );

    expect(result.experience[0]).toMatchObject({
      scope: 'skill',
      status: 'uncertain',
    });

    expect(result.band).toBe('review');
  });

  it('caps extraction and keeps unrecognized descriptions reviewable', () => {
    expect(featureJob('a'.repeat(200_001)).requirements.warnings[0]).toContain('limit');

    const result = scoreJob(featureJob('We use Python.'), candidate(), employers, false);

    expect(result).toMatchObject({ band: 'review', completeness: 25, baseScore: 100 });
  });

  it('groups comma-separated alternatives and rejects ordinary language alias collisions', () => {
    expect(
      featureJob(
        'Requirements\nJava, Kotlin or C++ required.',
      ).requirements.skills[0]!.alternatives.map((skill) => skill.id),
    ).toEqual(['java', 'kotlin', 'cpp']);

    expect(
      featureJob(
        'Requirements\nMust react quickly to customer requests.\nWe go beyond expectations.',
      ).requirements.skills,
    ).toEqual([]);

    expect(
      featureJob('Requirements\n3 to 5 years of experience with Java or Kotlin.').requirements
        .experience[0],
    ).toMatchObject({ scope: 'skill', skillId: null, minimumMonths: 36 });
  });

  it('keeps unsupported mandatory statements unresolved instead of treating them as a fit', () => {
    const result = scoreJob(
      featureJob('Requirements\nTypeScript required.\nKnowledge of VHDL and RTL required.'),
      candidate(),
      employers,
      true,
    );

    expect(result.band).toBe('review');
    expect(result.completeness).toBeLessThan(60);
    expect(result.uncertainties.join(' ')).toContain('VHDL');
    expect(result.employerAdjustment.points).toBe(0);

    expect(
      scoreJob(
        featureJob('Requirements\nTypeScript and VHDL required.'),
        candidate(),
        employers,
        true,
      ).band,
    ).toBe('review');
  });
});

describe('reviewed-profile comparisons', () => {
  it('does not satisfy mandatory skills with learning, negation, or an unsupported claim', () => {
    for (const status of ['learning', 'negated', 'mentioned'] as const) {
      const profile = candidate();

      profile.skills[0]!.status = status;

      expect(scoreJob(featureJob(), profile, employers, true)).toMatchObject({
        band: 'exploratory',
        requiredGaps: 1,
        employerAdjustment: { points: 0 },
      });
    }
  });

  it('unions overlaps and distinguishes below and uncertain date thresholds', () => {
    const profile = candidate();

    profile.employment.push({ ...profile.employment[0]!, start: 'Jan 2022', end: 'Dec 2023' });

    expect(
      scoreJob(
        featureJob('Requirements\nTypeScript required\n5 years professional experience'),
        profile,
        employers,
        true,
      ),
    ).toMatchObject({
      requiredGaps: 1,
      experience: [{ status: 'below', candidateMinimumMonths: 48 }],
    });

    profile.employment[0]!.start = '2020';
    profile.employment[0]!.end = '2023';
    profile.employment.pop();

    expect(
      scoreJob(
        featureJob('Requirements\nTypeScript required\n4 years professional experience'),
        profile,
        employers,
        true,
      ),
    ).toMatchObject({ band: 'review', experience: [{ status: 'uncertain' }] });
  });

  it('does not infer matching cities or worldwide permission from a country or remote flag', () => {
    const profile = candidate();

    profile.location.value = 'Rotterdam, Netherlands';

    const job = featureJob(
      'Requirements\nTypeScript required\n2 years professional experience\nRemote only in Netherlands.',
    );

    job.requirements.workplace = 'remote';
    expect(scoreJob(job, profile, employers, false)).toMatchObject({ band: 'review' });
    expect(scoreJob(job, profile, employers, false).location).toContain('Unknown');
  });

  it('employer context is opt-in, capped, neutral for unknown employers and cannot change a band', () => {
    const job = featureJob();
    const profile = candidate();
    const baseline = scoreJob(job, profile, employers, false);
    const weighted = scoreJob(job, profile, employers, true);

    expect(baseline.employerAdjustment.points).toBe(0);
    expect(weighted.employerAdjustment.points).toBe(3);
    expect(weighted.band).toBe(baseline.band);
    expect(weighted.baseScore).toBe(baseline.baseScore);
    profile.employment[0]!.employer = 'Unknown Labs';

    const neutral = scoreJob(job, profile, employers, true);

    expect(neutral.baseScore).toBe(baseline.baseScore);
    expect(neutral.employerAdjustment.points).toBe(0);
    profile.employment[0]!.employer = 'Meta';
    profile.employment[0]!.relationship = 'client';
    expect(scoreJob(job, profile, employers, true).employerAdjustment.points).toBe(0);
  });
});
