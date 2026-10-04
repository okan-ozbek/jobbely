import { expect, it } from 'vitest';
import { coverageLabel, mergeReview, reviewQuestions } from './semantic-review.js';
import { matchProfile } from './match-profile.js';
import type { JobMatchResponse, ResumeAnalysis } from '../../api/client.js';

it('caps relevant questions at five, deduplicates scopes, and keeps full/partial labels distinct', () => {
  const skills = Array.from({ length: 10 }, (_, index) => ({
    suggestion: {
      id: `tool-${index}`,
      name: `Tool ${index}`,
      facet: 'usage',
      question: 'Used it?',
    },
  })) as JobMatchResponse['comparison']['skills'];

  expect(reviewQuestions([skills[0]!, ...skills])).toHaveLength(5);
  expect(coverageLabel('suggested')).toBe('Possible unmentioned skill');
  expect(coverageLabel('partial')).toBe('Partial or uncertain');
  expect(coverageLabel('full')).toBe('Full match');
});

it('replaces an answer to one scope while retaining other scoped answers', () => {
  const reviews = mergeReview(
    [
      { id: 'clang', facet: 'usage', answer: 'denied' },
      { id: 'clang', facet: 'development', answer: 'unsure' },
    ],
    { id: 'clang', facet: 'usage', answer: 'confirmed' },
  );

  expect(reviews).toEqual([
    { id: 'clang', facet: 'development', answer: 'unsure' },
    { id: 'clang', facet: 'usage', answer: 'confirmed' },
  ]);
});

it('carries bounded semantic claims without sending private excerpts or document text', () => {
  const analysis = {
    analysisDate: '2026-10-02',
    skills: [
      {
        id: 'clang',
        name: 'Clang',
        status: 'user_confirmed',
        facets: ['usage'],
        deniedFacets: ['development'],
        interpretation: 'explicit',
        evidence: [{ lineId: 'line-1', excerpt: 'Private fictional address', rule: 'test' }],
      },
    ],
    competencies: [],
    employment: [],
    location: { value: '', status: 'unknown' },
    document: { text: 'Private fictional address', lines: [] },
  } as unknown as ResumeAnalysis;

  expect(matchProfile(analysis).skills[0]).toEqual({
    id: 'clang',
    status: 'user_confirmed',
    facets: ['usage'],
    deniedFacets: ['development'],
    interpretation: 'explicit',
  });

  expect(JSON.stringify(matchProfile(analysis))).not.toContain('Private fictional address');
});

it('serializes only bounded evidence reference fields, never injected private metadata', () => {
  const analysis = {
    analysisDate: '2026-10-02',
    skills: [
      {
        id: 'python',
        status: 'work_evidenced',
        evidenceRefs: [
          {
            blockId: 'resume-block-3',
            lineIds: ['line-3'],
            source: 'project',
            action: 'build',
            objectId: 'python',
            outcome: 'unspecified',
            assertion: 'performed',
            excerpt: 'PRIVATE_REF_SENTINEL',
            contact: 'PRIVATE_REF_SENTINEL',
          },
        ],
      },
    ],
    competencies: [],
    employment: [],
    location: { value: '', status: 'unknown' },
  } as unknown as ResumeAnalysis;

  const profile = matchProfile(analysis);

  expect(profile.skills[0]?.evidenceRefs?.[0]).toEqual({
    blockId: 'resume-block-3',
    lineIds: ['line-3'],
    source: 'project',
    action: 'build',
    objectId: 'python',
    outcome: 'unspecified',
    assertion: 'performed',
  });

  expect(JSON.stringify(profile)).not.toContain('PRIVATE_REF_SENTINEL');
});
