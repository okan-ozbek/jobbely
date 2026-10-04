import { describe, expect, it } from 'vitest';
import { candidate, featureJob } from '../../test-fixtures/resume-matching.js';
import { scoreJob } from './score.js';

describe('education, experience and role relevance comparison', () => {
  it('requires skill years for developing a specific system and leaves combined degree obligations unresolved', () => {
    const profile = candidate();

    profile.skills.push({ id: 'distributed-systems', status: 'user_confirmed' });

    const result = scoreJob(
      featureJob(
        'Requirements\n4 years of experience developing distributed systems.\nBachelor and Master degrees in Computer Science required.',
      ),
      profile,
      [],
      false,
    );

    expect(result.experience[0]?.scope).toBe('skill');
    expect(result.experience[0]?.status).toBe('uncertain');
    expect(result.education).toEqual([]);
    expect(result.band).toBe('review');
  });

  const job = featureJob(
    'Requirements\nBS (or higher) in Computer Science, or a related field\nJava required.\n7+ years of production level experience in one of: Java, Scala, C++, or similar language.',
  );

  it('accepts higher completed degrees in reviewed related fields and explicit tool years', () => {
    const profile = candidate();

    profile.education = [{ level: 'master', field: 'mathematics', completion: 'completed' }];
    profile.skills = [{ id: 'java', status: 'user_confirmed' }];
    profile.skillTenure = [{ skillId: 'java', months: 96 }];

    const result = scoreJob(job, profile, [], false);

    expect(result.education[0]?.status).toBe('met');

    expect(result.experience[0]).toMatchObject({
      scope: 'skill',
      status: 'met',
      candidateMinimumMonths: 96,
    });

    expect(result.requiredGaps).toBe(0);
  });

  it('keeps missing education and skill-specific tenure unresolved instead of reusing the career total', () => {
    const result = scoreJob(job, candidate(), [], false);

    expect(result.education[0]?.status).toBe('uncertain');
    expect(result.experience[0]?.status).toBe('uncertain');
    expect(result.band).toBe('review');
  });

  it('does not add alternative durations or accept a low known duration while other alternatives remain unknown', () => {
    const profile = {
      ...candidate(),
      skills: [
        { id: 'java', status: 'user_confirmed' as const },
        { id: 'scala', status: 'user_confirmed' as const },
      ],
      skillTenure: [{ skillId: 'java', months: 36 }],
    };

    expect(scoreJob(job, profile, [], false).experience[0]?.status).toBe('uncertain');
    profile.skillTenure.push({ skillId: 'scala', months: 36 });
    expect(scoreJob(job, profile, [], false).experience[0]?.status).toBe('uncertain'); // "similar language" is still unreviewed.

    const explicitAlternatives = featureJob(
      'Requirements\n7 years of experience in Java or Scala.',
    );

    expect(scoreJob(explicitAlternatives, profile, [], false).experience[0]?.status).toBe('below');
  });

  it('keeps unrelated degree subjects unresolved and does not reuse an independent AND skill for OR tenure', () => {
    const profile = {
      ...candidate(),
      education: [
        { level: 'bachelor' as const, field: 'other' as const, completion: 'completed' as const },
      ],
      skills: [{ id: 'sql', status: 'user_confirmed' as const }],
      skillTenure: [{ skillId: 'sql', months: 120 }],
    };

    expect(
      scoreJob(featureJob('Requirements\nBA in History required.'), profile, [], false).education[0]
        ?.status,
    ).toBe('uncertain');

    expect(
      scoreJob(
        featureJob('Requirements\n7 years of experience in Java or Scala and SQL.'),
        profile,
        [],
        false,
      ).experience[0]?.status,
    ).toBe('uncertain');
  });

  it('recognizes the annotated technical responsibilities while retaining their contextual importance', () => {
    const target = featureJob(
      'The impact you’ll have\nProblems that span from product to infrastructure including: distributed systems, at-scale service architecture and monitoring, workflow orchestration, and developer experience.\nDeliver reliable and high performance services and client libraries for storing and accessing data on cloud storage backends, e.g., AWS S3, Azure Blob Store.\nBuild reliable, scalable services, e.g. Scala, Kubernetes, and data pipelines, e.g. Spark, Databricks.',
    );

    const ids = target.requirements.skills.flatMap((group) =>
      group.alternatives.map((item) => item.id),
    );

    expect(ids).toEqual(
      expect.arrayContaining([
        'distributed-systems',
        'architecture-design',
        'monitoring',
        'workflow-orchestration',
        'developer-experience',
        'high-performance-services',
        'client-libraries',
        'cloud-storage',
        'aws-s3',
        'azure-blob',
        'scala',
        'kubernetes',
        'data-pipelines',
        'spark',
        'databricks',
      ]),
    );

    expect(target.requirements.skills.every((group) => group.importance === 'contextual')).toBe(
      true,
    );
  });

  it('does not meet a master requirement with a bachelor or an unfinished master', () => {
    const target = featureJob(
      'Requirements\nMS in Computer Science required.\nTypeScript required.',
    );

    for (const degree of [
      { level: 'bachelor', field: 'computer-science', completion: 'completed' },
      { level: 'master', field: 'computer-science', completion: 'in-progress' },
    ] as const) {
      const result = scoreJob(target, { ...candidate(), education: [degree] }, [], false);

      expect(result.education[0]?.status).toBe('below');
      expect(result.requiredGaps).toBeGreaterThan(0);
    }
  });

  it('keeps equivalent experience alternatives unresolved when education is below the requirement', () => {
    const result = scoreJob(
      featureJob(
        'Requirements\nBS in Computer Science or equivalent experience.\nTypeScript required.',
      ),
      {
        ...candidate(),
        education: [{ level: 'bachelor', field: 'business', completion: 'completed' }],
      },
      [],
      false,
    );

    expect(result.education[0]?.status).toBe('uncertain');
    expect(result.band).toBe('review');
  });

  it('adds at most five responsibility points, preserves mandatory gaps, and excludes company/benefit/legal context', () => {
    const description =
      'Requirements\nTypeScript required.\nDocker required.\nThe impact you’ll have\nBuild Scala and Kubernetes services.\nAbout us\nWe use Python.\nBenefits\nWe offer AWS courses.';

    const profile = candidate();
    const absent = scoreJob(featureJob(description), profile, [], false);

    profile.skills.push(
      { id: 'scala', status: 'user_confirmed' },
      { id: 'kubernetes', status: 'user_confirmed' },
    );

    const present = scoreJob(featureJob(description), profile, [], false);

    const qualificationsOnly = scoreJob(
      featureJob(description.split('The impact')[0]),
      profile,
      [],
      false,
    );

    expect(present.baseScore - qualificationsOnly.baseScore).toBeLessThanOrEqual(5);
    expect(present.roleRelevancePoints).toBe(5);
    expect(present.baseScore).toBeGreaterThan(absent.baseScore);
    expect(present.requiredGaps).toBe(absent.requiredGaps);

    expect(
      present.skills
        .filter((item) => item.importance === 'contextual')
        .flatMap((item) => item.names),
    ).toEqual(['Scala', 'Kubernetes']);

    expect(present.band).toBe('exploratory');
  });
});
