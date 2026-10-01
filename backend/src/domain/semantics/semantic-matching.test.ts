import { describe, expect, it } from 'vitest';
import { AnalyzeResume, ResumeInputError } from '../../application/resume/analyze-resume.js';
import { activityCases, unrelatedCases } from '../../test-fixtures/semantic-clauses.js';
import { candidate, featureJob } from '../../test-fixtures/resume-matching.js';
import { concepts } from './concepts.js';
import { phraseRules } from './clauses.js';
import { recognizeConcepts } from './recognize.js';
import { projectSkills, skillMatch } from '../matching/skill-relations.js';
import { scoreJob } from '../matching/score.js';
import type { MatchProfile } from '../matching/model.js';

const analyzer = new AnalyzeResume([], () => new Date('2026-10-02T00:00:00Z'));

function profile(activity: string): MatchProfile {
  const result = analyzer.execute({
    text: `Experience\nSoftware Engineer | Fictional Labs\nJan 2020 - Dec 2025\n${activity}`,
  });

  return {
    ...candidate(),
    analysisDate: result.analysisDate,
    skills: result.skills,
    competencies: result.competencies,
  };
}

describe('labeled activity contrasts (156 clauses)', () => {
  for (const [activity, id] of activityCases) {
    for (const [prefix, expected] of [
      ['', 'full'],
      ['I did not ', 'none'],
      ['I observed another team that ', 'partial'],
      ['I plan to ', 'partial'],
      ['I am learning to ', 'partial'],
      ['Our platform uses ', 'partial'],
    ] as const) {
      it(`${prefix}${activity}: ${expected}`, () => {
        const result = skillMatch(
          projectSkills([
            ...profile(prefix + activity).skills,
            ...(profile(prefix + activity).competencies ?? []),
          ]),
          id,
        );

        expect(result.decision).toBe(expected);

        if (expected !== 'full') {
          expect(result.credit).toBe(0);
        }
      });
    }
  }
});

describe('unrelated text stays unasserted (20 clauses)', () => {
  for (const [text, id] of unrelatedCases) {
    it(text, () => {
      const result = analyzer.execute({
        text:
          text.startsWith('Contact:') || text.startsWith('Employer:')
            ? text
            : `Experience\n${text}`,
      });

      expect([...result.skills, ...result.competencies].some((item) => item.id === id)).toBe(false);

      // Specific tool/component names cannot imply the containing tool as an exact mention.
      if (['Used clang-tidy', 'Read LLVM IR'].includes(text)) {
        expect(recognizeConcepts(text).some((item) => item.id === id)).toBe(false);
      }
    });
  }
});

it('validates the typed registry, stable aliases, facets and phrase outputs', () => {
  const ids = new Set(concepts.map((item) => item.id));

  expect(ids.size).toBe(concepts.length);
  expect(concepts.length).toBeGreaterThanOrEqual(200);

  const aliases = new Map<string, string>();

  for (const concept of concepts) {
    expect(concept.definition.length).toBeGreaterThan(20);
    expect(concept.facets.length).toBeGreaterThan(0);

    for (const alias of concept.aliases) {
      expect(aliases.get(alias.toLowerCase()) ?? concept.id).toBe(concept.id);
      aliases.set(alias.toLowerCase(), concept.id);
    }
  }

  for (const rule of phraseRules) {
    for (const output of rule.concepts) {
      expect(ids.has(output.id)).toBe(true);
    }
  }
});

describe('30 profile/job comparisons', () => {
  const pairs: [string, string, string, string][] = [
    [
      'Implemented automatic failover between replicas',
      'Fault tolerance required.',
      'fault-tolerance',
      'full',
    ],
    [
      'Kept services running when machines failed',
      'High availability required.',
      'high-availability',
      'full',
    ],
    ['Cut p99 request time', 'Low latency required.', 'low-latency', 'full'],
    [
      'Profiled CPU bottlenecks',
      'Performance optimization required.',
      'performance-optimization',
      'full',
    ],
    [
      'Delivered changes spanning engineering, product and operations',
      'Cross-functional delivery required.',
      'cross-functional-delivery',
      'full',
    ],
    [
      'Owned initiatives across teams',
      'Cross-functional leadership required.',
      'cross-functional-leadership',
      'full',
    ],
    ['Set technical direction', 'Technical direction required.', 'technical-direction', 'full'],
    ['Managed a team of engineers', 'Team leadership required.', 'leadership', 'full'],
    ['Mentored junior developers', 'Mentoring required.', 'mentoring', 'full'],
    ['Wrote LLVM optimization passes', 'LLVM optimization passes required.', 'llvm', 'full'],
    ['Extended the Clang frontend', 'Clang frontend development required.', 'clang', 'full'],
    ['Used Clang to compile C++', 'Clang frontend development required.', 'clang', 'partial'],
    ['Built C++ services', 'Clang required.', 'clang', 'suggested'],
    ['Built C++ services', 'LLVM optimization passes required.', 'llvm', 'suggested'],
    ['Built C++ services', 'CMake required.', 'cmake', 'suggested'],
    ['Built services using Redis', 'AWS required.', 'aws', 'partial'],
    [
      'Built services using Redis',
      'Distributed systems required.',
      'distributed-systems',
      'partial',
    ],
    ['Built services using AWS', 'Distributed systems required.', 'distributed-systems', 'partial'],
    ['Built services using Rust', 'Memory management required.', 'memory-management', 'partial'],
    ['Built services using Python', 'Clang required.', 'clang', 'none'],
    ['No experience with AWS or Azure', 'AWS required.', 'aws', 'none'],
    ['No experience with AWS or Azure', 'Azure required.', 'azure', 'none'],
    ['Learning C++', 'Clang required.', 'clang', 'none'],
    [
      'I plan to implement automatic failover',
      'Fault tolerance required.',
      'fault-tolerance',
      'partial',
    ],
    ['Our platform uses AWS', 'AWS required.', 'aws', 'partial'],
    ['Observed another team implementing failover', 'Failover required.', 'failover', 'partial'],
    [
      'Restored services after server failures',
      'Fault tolerance required.',
      'fault-tolerance',
      'full',
    ],
    ['Processed requests concurrently', 'Concurrency required.', 'concurrency', 'full'],
    ['Optimized SQL queries', 'Query optimization required.', 'query-optimization', 'full'],
    ['Rolled out changes gradually', 'Canary deployments required.', 'canary-deployments', 'full'],
  ];

  for (const [activity, requirement, id, decision] of pairs) {
    it(`${activity} → ${requirement}`, () => {
      const result = scoreJob(
        featureJob(`Requirements\n${requirement}`),
        profile(activity),
        [],
        true,
      );

      const match = result.skills.find((item) => item.targetId === id)!;

      expect(match.decision).toBe(decision);

      if (decision === 'suggested') {
        expect(match.credit).toBe(0);
      }

      if (decision !== 'full') {
        expect(result.requiredGaps).toBeGreaterThan(0);
      }
    });
  }
});

it('confirms, denies and leaves unsure tool scopes separate, without claiming years', () => {
  const text = 'Experience\nBuilt C++ services.';
  const initial = analyzer.execute({ text });

  expect(skillMatch(projectSkills(initial.skills), 'clang').decision).toBe('suggested');

  for (const [answer, decision] of [
    ['confirmed', 'full'],
    ['denied', 'none'],
    ['unsure', 'partial'],
  ] as const) {
    const result = analyzer.execute({
      text,
      corrections: { signalReviews: [{ id: 'clang', facet: 'usage', answer }] },
    });

    const matches = projectSkills(result.skills);

    expect(skillMatch(matches, 'clang', 'usage').decision).toBe(decision);
    expect(skillMatch(matches, 'clang', 'usage').suggestion).toBeNull();
    expect(skillMatch(matches, 'clang', 'development').credit).toBeLessThan(1);
    expect(result.experience.professional.minimumMonths).toBe(0);
  }

  const confirmed = analyzer.execute({
    text,
    corrections: { signalReviews: [{ id: 'clang', facet: 'development', answer: 'confirmed' }] },
  });

  expect(skillMatch(projectSkills(confirmed.skills), 'clang', 'development').credit).toBe(1);
  expect(skillMatch(projectSkills(confirmed.skills), 'clang', 'usage').credit).toBe(1);

  expect(() =>
    analyzer.execute({
      text,
      corrections: { signalReviews: [{ id: 'java', facet: 'development', answer: 'confirmed' }] },
    }),
  ).toThrow(ResumeInputError);
});

it('preserves scoped negation, UTF-16 spans, alternatives and compound tenure', () => {
  const p = profile('No experience with AWS or Azure, but built services using Python.');

  expect(skillMatch(projectSkills(p.skills), 'aws').credit).toBe(0);
  expect(skillMatch(projectSkills(p.skills), 'azure').credit).toBe(0);
  expect(skillMatch(projectSkills(p.skills), 'python').credit).toBe(1);

  const text = 'λ 🟣 Implemented automatic failover; used clang-tidy.';

  for (const mention of recognizeConcepts(text)) {
    expect(text.slice(mention.position, mention.position + mention.length).length).toBe(
      mention.length,
    );
  }

  const job = featureJob(
    'Requirements\nJava or Kotlin required.\n7+ years building production systems, including 2+ years managing engineers.\nOur platform uses AWS.',
  );

  expect(job.requirements.skills[0]!.alternatives.map((item) => item.id)).toEqual([
    'java',
    'kotlin',
  ]);

  expect(job.requirements.experience).toMatchObject([
    { minimumMonths: 84, scope: 'function' },
    { minimumMonths: 24, scope: 'skill', skillId: 'leadership' },
  ]);

  expect(
    job.requirements.skills.find((item) => item.alternatives[0]?.id === 'aws')!.importance,
  ).toBe('contextual');

  const activity = featureJob('Requirements\nImplemented automatic failover between replicas.');

  expect(activity.requirements.skills).toHaveLength(1);
});

it('retains strong work evidence when a skills list repeats it, while keeping other facets uncertain', () => {
  const result = analyzer.execute({
    text: 'Experience\nBuilt TypeScript services.\nUsed Clang.\nLearning Clang frontend development.\nSkills\nTypeScript, Clang',
  });

  const matches = projectSkills(result.skills);

  expect(skillMatch(matches, 'typescript').credit).toBe(1);
  expect(skillMatch(matches, 'clang', 'usage').credit).toBe(1);

  expect(skillMatch(matches, 'clang', 'development')).toMatchObject({
    decision: 'partial',
    credit: 0,
    suggestion: null,
  });
});

it('ends qualification sections before employer policy and leaves alternative tenure paths for review', () => {
  const job = featureJob(
    "Minimum Requirements:\nBachelor's degree and 3+ years of experience OR Master's degree and 2+ years of experience.\nPreferred Qualifications:\nLLVM preferred.\nPosting Statement:\nAll qualified applicants receive consideration.\nCandidates should never be required to pay recruitment fees.\nWe comply with ethical hiring practices.",
  );

  expect(job.requirements.experience).toHaveLength(0);

  expect(
    job.requirements.unparsed.some(
      (item) => item.evidence.rule === 'requirements:alternative-tenure',
    ),
  ).toBe(true);

  expect(
    job.requirements.skills
      .filter((group) => group.importance !== 'contextual')
      .flatMap((group) => group.alternatives)
      .map((item) => item.id),
  ).toEqual(['llvm']);
});

it('denial of development suppresses that question without denying an unanswered usage scope', () => {
  const result = analyzer.execute({
    text: 'Experience\nBuilt C++ services.',
    corrections: { signalReviews: [{ id: 'llvm', facet: 'development', answer: 'denied' }] },
  });

  const matches = projectSkills(result.skills);

  expect(skillMatch(matches, 'llvm', 'development')).toMatchObject({
    decision: 'none',
    credit: 0,
    suggestion: null,
  });

  expect(skillMatch(matches, 'llvm', 'usage')).toMatchObject({ decision: 'suggested', credit: 0 });
});
