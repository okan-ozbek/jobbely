import { expect, it } from 'vitest';
import { reviewedSkillTenure } from './skill-tenure.js';
import { matchProfile } from './match-profile.js';
import type { ResumeAnalysis } from '../../api/client.js';

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
