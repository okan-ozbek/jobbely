import { describe, expect, it } from 'vitest';
import { projectSkills, skillMatch, skillRelations } from './skill-relations.js';
import {
  skillsInText,
  skillMentions,
  supportedConcepts,
  detectCompetencies,
} from '../resume/vocabulary.js';
import { featureJob, candidate } from '../../test-fixtures/resume-matching.js';
import { scoreJob } from './score.js';

describe('weighted skill evidence', () => {
  it('keeps direct evidence green and a distant Redis/cloud/AWS inference weak and orange', () => {
    const matches = projectSkills([{ id: 'redis', status: 'work_evidenced' }]);

    expect(skillMatch(matches, 'redis')).toMatchObject({
      confidence: 'green',
      credit: 1,
      path: [],
    });

    expect(skillMatch(matches, 'aws')).toMatchObject({
      confidence: 'orange',
      credit: 0.03,
      sourceId: 'redis',
      path: [
        { from: 'redis', to: 'cloud-infrastructure' },
        { from: 'cloud-infrastructure', to: 'aws' },
      ],
    });

    expect(skillMatch(matches, 'distributed-systems')).toMatchObject({
      confidence: 'orange',
      credit: 0.25,
    });

    expect(skillMatch(matches, 'python')).toMatchObject({ confidence: 'red', credit: 0 });

    expect(
      skillMatch(
        projectSkills([{ id: 'distributed-systems', status: 'work_evidenced' }]),
        'fault-tolerance',
      ),
    ).toMatchObject({ confidence: 'orange', credit: 0.35 });
  });

  it('never lets relations override direct evidence, negation or learning, or satisfy mandatory gaps', () => {
    const profile = candidate();

    profile.skills = [
      { id: 'redis', status: 'user_confirmed' },
      { id: 'aws', status: 'negated' },
      { id: 'cloud-infrastructure', status: 'learning' },
    ];

    const result = scoreJob(
      featureJob('Requirements\nAWS required.\nCloud infrastructure required.\nRedis required.'),
      profile,
      [],
      true,
    );

    expect(result.skills.map((item) => [item.confidence, item.credit])).toEqual([
      ['red', 0],
      ['orange', 0],
      ['green', 1],
    ]);

    expect(result.requiredGaps).toBe(2);
    expect(result.employerAdjustment.points).toBe(0);
    profile.skills = [{ id: 'redis', status: 'work_evidenced' }];

    expect(scoreJob(featureJob('Requirements\nAWS required.'), profile, [], false)).toMatchObject({
      requiredGaps: 1,
      skills: [{ confidence: 'orange', credit: 0.03 }],
    });
  });

  it('uses the strongest bounded path without accumulating duplicate or cyclical evidence', () => {
    const signals = [
      { id: 'cpp', status: 'work_evidenced' },
      { id: 'rust', status: 'work_evidenced' },
    ] as const;

    const first = projectSkills([...signals]);
    const second = projectSkills([...signals].reverse());

    expect(skillMatch(first, 'systems-programming')).toEqual(
      skillMatch(second, 'systems-programming'),
    );

    expect(skillMatch(first, 'systems-programming').credit).toBe(0.8);

    expect(
      [...first.values()].every(
        (item) => item.path.length <= 2 && (!item.path.length || item.credit <= 0.8),
      ),
    ).toBe(true);

    expect(
      skillMatch(projectSkills([{ id: 'cpp', status: 'learning' }]), 'memory-management')
        .confidence,
    ).toBe('red');
  });

  it('validates every reviewed edge and leaves unsupported claims disconnected', () => {
    const ids = new Set(supportedConcepts.map((item) => item.id));
    const pairs = new Set<string>();

    for (const edge of skillRelations) {
      expect(ids.has(edge.from) && ids.has(edge.to)).toBe(true);
      expect(edge.from).not.toBe(edge.to);
      expect(edge.weight).toBeGreaterThan(0);
      expect(edge.weight).toBeLessThan(1);
      expect(pairs.has(`${edge.from}:${edge.to}`)).toBe(false);
      pairs.add(`${edge.from}:${edge.to}`);
    }

    expect(
      skillMatch(
        projectSkills([{ id: 'custom:big teams', status: 'user_confirmed' }]),
        'distributed-systems',
      ).confidence,
    ).toBe('red');
  });

  it('extracts both Snowflake-style tenure wishes without equating leadership to professional tenure', () => {
    const job = featureJob(
      'As a Senior Distributed Systems Engineer at Fictional Labs you will:\nLead cross-functional initiatives.\nOur ideal Distributed Systems Engineer will have:\n7+ years industry experience designing, building and supporting large scale systems in production.\n2+ years experience in leading a group of junior and senior engineers.\nFluency in C++ or Java preferred.\nExperience with cloud infrastructure: AWS, Azure or Google Cloud.\nWhy join the Engineering team at Fictional Labs?\nWe use Python.',
    );

    expect(job.requirements.experience).toMatchObject([
      { minimumMonths: 84, scope: 'professional', importance: 'required' },
      { minimumMonths: 24, scope: 'skill', skillId: 'leadership', importance: 'required' },
    ]);

    expect(
      job.requirements.skills.find((item) => item.alternatives[0]?.id === 'cpp'),
    ).toMatchObject({ importance: 'preferred', alternatives: [{ id: 'cpp' }, { id: 'java' }] });

    const result = scoreJob(job, candidate(), [], false);

    expect(result.experience).toMatchObject([
      { minimumMonths: 84 },
      { minimumMonths: 24, status: 'uncertain' },
    ]);

    expect(
      job.requirements.skills.find((item) => item.alternatives[0]?.id === 'python')?.importance,
    ).toBe('contextual');
  });

  it('recognizes technical concepts and cross-team competency evidence, not generic performance or big teams', () => {
    expect(
      skillsInText('Fault-tolerance, high availability and multithreading.').map((item) => item.id),
    ).toEqual(['fault-tolerance', 'high-availability', 'multithreading']);

    expect(skillsInText('Big teams and strong performance.')).toEqual([]);
    expect(skillsInText('A low level of responsibility.')).toEqual([]);

    expect(skillsInText('Low level operating systems concepts.').map((item) => item.id)).toEqual([
      'low-level',
      'operating-systems',
    ]);

    const competencies = detectCompetencies([
      {
        id: '1',
        number: 1,
        start: 0,
        end: 54,
        text: 'Led cross-functional initiatives with other teams.',
        section: 'experience',
        heading: false,
      },
    ]);

    expect(competencies[0]?.id).toBe('cross-functional-leadership');

    const profile = candidate();

    profile.competencies = competencies;

    expect(
      scoreJob(
        featureJob('Requirements\nCross-functional leadership required.'),
        profile,
        [],
        false,
      ).skills[0]?.confidence,
    ).toBe('green');
  });

  it('annotates repeated aliases at exact offsets and retains unknown text', () => {
    const text = 'AWS, AWS.\nC++ and concurrency.\nAWS. λ未知';
    const mentions = skillMentions(text);

    expect(mentions.filter((item) => item.id === 'aws')).toHaveLength(3);

    expect(mentions.map((item) => text.slice(item.position, item.position + item.length))).toEqual([
      'AWS',
      'AWS',
      'C++',
      'concurrency',
      'AWS',
    ]);

    expect(skillMentions('awsome JavaScript Java').map((item) => item.id)).toEqual([
      'javascript',
      'java',
    ]);
  });
});
