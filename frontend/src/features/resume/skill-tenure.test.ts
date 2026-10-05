import { expect, it } from 'vitest';
import { reviewedSkillTenure, skillDurationMonths } from './skill-tenure.js';
import { matchProfile } from './match-profile.js';
import type { ResumeAnalysis } from '../../api/client.js';

it('preserves individual months and enforces whole-number duration bounds', () => {
  expect(skillDurationMonths('0', '7')).toBe(7);
  expect(skillDurationMonths('2', '6')).toBe(30);
  expect(skillDurationMonths('0', '0')).toBe(0);
  expect(skillDurationMonths('50', '0')).toBe(600);

  for (const [years, months] of [
    ['', '7'],
    ['1', ''],
    ['0.5', '0'],
    ['1', '12'],
    ['50', '1'],
    ['-1', '0'],
    ['1', '-1'],
  ]) {
    expect(skillDurationMonths(years!, months!)).toBeNull();
  }
});

function profile(changes: Partial<ResumeAnalysis> = {}): ResumeAnalysis {
  return {
    analysisDate: '2026-10-05',
    skills: [
      {
        id: 'typescript',
        name: 'TypeScript',
        status: 'work_evidenced',
        interpretation: 'explicit',
        evidence: [],
      },
    ],
    competencies: [],
    employment: [],
    location: { value: '', status: 'unknown' },
    skillTenureEstimates: [
      { skillId: 'typescript', minimumMonths: 48, maximumMonths: 48, roleIds: ['private-role'] },
    ],
    ...changes,
  } as ResumeAnalysis;
}

it('includes reviewed exact estimates without sending their private role origins', () => {
  const analysis = profile();

  expect(reviewedSkillTenure(analysis)).toEqual([{ skillId: 'typescript', months: 48 }]);
  expect(JSON.stringify(matchProfile(analysis))).not.toContain('private-role');
});

it('preserves explicit/manual duration precedence, including a zero override', () => {
  expect(
    reviewedSkillTenure(profile({ skillTenure: [{ skillId: 'typescript', months: 0 }] })),
  ).toEqual([{ skillId: 'typescript', months: 0 }]);

  expect(
    reviewedSkillTenure(profile({ skillTenure: [{ skillId: 'typescript', months: 18 }] })),
  ).toEqual([{ skillId: 'typescript', months: 18 }]);
});

it('requires manual review for coarse dates and excludes removed or inferred skills', () => {
  expect(
    reviewedSkillTenure(
      profile({
        skillTenureEstimates: [
          { skillId: 'typescript', minimumMonths: 26, maximumMonths: 48, roleIds: ['role'] },
        ],
      }),
    ),
  ).toEqual([]);

  expect(reviewedSkillTenure(profile({ skills: [] }))).toEqual([]);

  const analysis = profile();

  expect(
    reviewedSkillTenure({
      ...analysis,
      skills: [{ ...analysis.skills[0]!, interpretation: 'interpreted' }],
    }),
  ).toEqual([]);

  expect(
    reviewedSkillTenure({
      ...analysis,
      skills: [{ ...analysis.skills[0]!, uncertainFacets: ['usage'] }],
    }),
  ).toEqual([]);
});

it('prioritizes explicit claims within the matching limit', () => {
  const skillTenure = Array.from({ length: 100 }, (_, i) => ({ skillId: `tool-${i}`, months: 12 }));

  expect(reviewedSkillTenure(profile({ skillTenure }))).toEqual(skillTenure);
});
