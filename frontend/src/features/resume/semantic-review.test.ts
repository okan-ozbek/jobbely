import { expect, it } from 'vitest';
import {
  coverageLabel,
  mergeReview,
  orderedSkillEvidence,
  reviewQuestions,
} from './semantic-review.js';
import { matchProfile } from './match-profile.js';
import type { JobMatchResponse, ResumeAnalysis } from '../../api/client.js';

it('orders skill evidence by coverage while preserving ties and the original response', () => {
  const skills = [
    { decision: 'none', names: ['Missing'] },
    { decision: 'full', names: ['Direct first'] },
    { decision: 'suggested', names: ['Suggested'] },
    { decision: 'partial', names: ['Related'] },
    { decision: 'full', names: ['Direct second'] },
  ] as JobMatchResponse['comparison']['skills'];

  expect(orderedSkillEvidence(skills).map((skill) => skill.names[0])).toEqual([
    'Direct first',
    'Direct second',
    'Related',
    'Suggested',
    'Missing',
  ]);

  expect(skills[0]!.decision).toBe('none');
});

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

it('accepts explicit listed keywords by default while preserving scope, negative and ambiguous claims', () => {
  const analysis = {
    analysisDate: '2026-10-05',
    skills: [
      {
        id: 'python',
        status: 'mentioned',
        interpretation: 'explicit',
        facets: [],
        uncertainFacets: ['usage'],
      },
      {
        id: 'clang',
        status: 'mentioned',
        interpretation: 'explicit',
        facets: ['usage'],
        uncertainFacets: ['development'],
        deniedFacets: ['development'],
      },
      { id: 'rust', status: 'learning', interpretation: 'explicit', uncertainFacets: ['usage'] },
      { id: 'java', status: 'negated', interpretation: 'explicit', deniedFacets: ['usage'] },
      { id: 'aws', status: 'mentioned', interpretation: 'ambiguous', uncertainFacets: ['usage'] },
      {
        id: 'systems-programming',
        status: 'mentioned',
        interpretation: 'interpreted',
        facets: ['general'],
      },
    ],
    competencies: [],
    employment: [],
    location: { value: '', status: 'unknown' },
  } as unknown as ResumeAnalysis;

  const result = matchProfile(analysis);

  expect(result.skills[0]).toMatchObject({
    status: 'user_confirmed',
    facets: ['usage'],
    uncertainFacets: [],
  });

  expect(result.skills[1]).toMatchObject({
    facets: ['usage'],
    uncertainFacets: ['development'],
    deniedFacets: ['development'],
  });

  expect(result.skills.slice(2).map((skill) => skill.status)).toEqual([
    'learning',
    'negated',
    'mentioned',
    'mentioned',
  ]);

  expect(result.skills[5]).toMatchObject({ interpretation: 'interpreted', facets: ['general'] });
  expect(result.employment).toEqual([]);
});
