import { describe, expect, it } from 'vitest';
import { AnalyzeResume } from '../../application/resume/analyze-resume.js';
import { htmlJobDocumentReader } from '../../infrastructure/job-document.js';
import { candidate, featureJob } from '../../test-fixtures/resume-matching.js';
import { skillsInText } from '../resume/vocabulary.js';
import { jobHeading } from './document.js';
import { extractRequirements } from './requirements.js';
import { scoreJob } from './score.js';

// Public-role paraphrases and fictional candidate evidence; no private attachment.
const infraRole = `Who We Are
Our AI workspace helps teams manage projects.
About The Role
Maintain an async task runner and configuration management platform.
What You'll Achieve
Debug production systems and manage failovers.
Participate in an on-call rotation, responding to incidents.
Grow your skills in distributed systems.
Skills You'll Need to Bring
A software developer with at least 4 years of experience and the ability to perform well in a fast-paced environment.
Systems thinker: You understand distributed systems and design for consistency, latency, and scalability.
Pragmatic problem-solver: Balance business impact and long-term maintainability.
Ownership and initiative: Be comfortable taking ownership of ambiguous problems.
Customer Empathy: You excel at collaborating across teams to build reliable systems.
You don't need to be an AI expert, but you're curious and willing to adopt AI tools.
By clicking Submit Application, agree to our Global Recruiting Privacy Policy.
A Note on AI
We use AI tools to work smarter.
Equal Opportunity
All qualified applicants are welcome.`;

const monetizationRole = `About the Team
Our company builds AI products.
About the Role
This role is exclusively based across San Francisco and Seattle sites.
In this role, you will:
Develop APIs, infrastructure services, and internal platforms.
Ensure engineering rigor through testing, documentation, and observability.
Drive rapid prototyping for backend systems.
You might thrive in this role if you:
Have 10+ years of experience building and operating large-scale distributed systems.
Have experience designing systems with demanding reliability, performance, and correctness requirements.
Think in systems: architecture, data flows, observability, and long-term maintainability.
Are comfortable defining technical direction in ambiguous environments.
Enjoy working cross-functionally to shape product requirements.
Communicate clearly and make decisions grounded in user needs.
Bonus: Experience in ads systems, marketplaces, AI/ML infra, or another monetization domain.
About Our Company
We develop AI products and publish an Applicant Privacy Policy.
Compensation
Equity offered for 1 year.`;

function requirementsFromHtml(text: string) {
  const document = htmlJobDocumentReader.read({
    descriptionText: text,
    descriptionHtml: text
      .split('\n')
      .map((line) => `<p>${jobHeading(line) ? `<strong>${line}</strong>` : line}</p>`)
      .join(''),
  });

  return {
    document,
    requirements: extractRequirements(
      {
        contentHash: 'synthetic',
        locations: [],
        workplace: 'unknown',
        descriptionText: document.text,
        classification: {
          category: 'engineering',
          method: 'source_mapping' as const,
          rule: 'test',
          evidence: '',
          version: 'test',
        },
      },
      document,
    ),
  };
}

function ids(text: string) {
  return skillsInText(text).map((item) => item.id);
}

describe('platform qualification contrasts', () => {
  it.each([
    "Skills You'll Need to Bring",
    'Skills You’ll Need to Bring:',
    'You might thrive in this role if you:',
    'You will thrive in this role if you',
  ])('recognizes qualification label %s', (heading) => {
    expect(jobHeading(heading)).toEqual({ role: 'qualifications', importance: 'required' });
  });

  it.each(["What You'll Achieve", 'What You’ll Achieve:', 'In this role, you will:'])(
    'keeps responsibility label %s contextual',
    (heading) => {
      expect(jobHeading(heading)).toEqual({ role: 'responsibilities', importance: 'contextual' });
    },
  );

  it('retains infrastructure qualifications in plain text and bold-label HTML', () => {
    for (const requirements of [
      featureJob(infraRole).requirements,
      requirementsFromHtml(infraRole).requirements,
    ]) {
      const required = requirements.skills
        .filter((group) => group.importance === 'required')
        .flatMap((group) => group.alternatives.map((item) => item.id));

      expect(required).toEqual(
        expect.arrayContaining([
          'distributed-systems',
          'data-consistency',
          'system-latency',
          'scalability',
          'system-maintainability',
          'problem-solving',
          'systems-thinking',
          'delivery-ownership',
          'initiative',
          'customer-empathy',
          'cross-team-collaboration',
          'system-reliability',
        ]),
      );

      expect(requirements.experience).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ minimumMonths: 48, importance: 'required' }),
        ]),
      );

      expect(
        requirements.unparsed.some((item) =>
          item.evidence.excerpt.includes('fast-paced environment'),
        ),
      ).toBe(true);

      expect(required).not.toContain('incident-response');
      expect(required).not.toContain('recruiting');

      expect(
        requirements.clauses.find((clause) => clause.evidence.excerpt.startsWith("You don't need")),
      ).toMatchObject({ importance: 'contextual', disposition: 'contextual' });
    }
  });

  it('separates duties, qualifications, bonus alternatives and explicit location restrictions', () => {
    const { document, requirements } = requirementsFromHtml(monetizationRole);

    const required = requirements.skills
      .filter((group) => group.importance === 'required')
      .flatMap((group) => group.alternatives.map((item) => item.id));

    expect(required).toEqual(
      expect.arrayContaining([
        'distributed-systems',
        'system-reliability',
        'system-performance',
        'system-correctness',
        'system-maintainability',
        'technical-direction',
        'cross-team-collaboration',
        'clear-communication',
      ]),
    );

    expect(required).not.toContain('api-development');

    expect(
      requirements.skills.find((group) =>
        group.alternatives.some((item) => item.id === 'api-development'),
      )?.importance,
    ).toBe('contextual');

    expect(requirements.experience).toEqual([
      expect.objectContaining({
        minimumMonths: 120,
        scope: 'skill',
        skillId: 'distributed-systems',
      }),
    ]);

    expect(requirements.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'location', importance: 'required' }),
      ]),
    );

    const bonus = requirements.skills.find((group) =>
      group.alternatives.some((item) => item.id === 'ads-systems'),
    );

    expect(bonus).toMatchObject({ importance: 'preferred', logic: 'any-of' });

    expect(bonus?.alternatives.map((item) => item.id)).toEqual([
      'ads-systems',
      'marketplace-systems',
      'ml-infrastructure',
    ]);

    expect(bonus?.unresolvedAlternatives).toEqual(['another monetization domain']);

    for (const clause of requirements.clauses) {
      expect(document.text.slice(clause.evidence.start, clause.evidence.end)).toBe(
        clause.evidence.excerpt,
      );
    }

    const result = scoreJob({ ...featureJob(), requirements }, candidate(), [], false);

    expect(result.fitScore).toBeNull();
    expect(result.unresolvedRequirements).toBeGreaterThan(0);
    expect(result.experience[0]?.status).toBe('uncertain');
  });

  it('recognizes plural and verb forms without equating API construction with API design', () => {
    expect(ids('Debug production systems and manage failovers.')).toEqual(
      expect.arrayContaining(['debugging', 'failover']),
    );

    expect(ids('Develop APIs for backend systems.')).toContain('api-development');
    expect(ids('Develop APIs for backend systems.')).not.toContain('api-design');
  });

  it('preserves disambiguated aliases and slash phrases inside alternatives while retaining unknown routes', () => {
    for (const [text, expected] of [
      ['Experience with Java, Spring or UncataloguedFramework required.', ['java', 'spring']],
      [
        'Experience with ads systems, marketplaces, AI/ML infra or another domain preferred.',
        ['ads-systems', 'marketplace-systems', 'ml-infrastructure'],
      ],
    ] satisfies [string, string[]][]) {
      const requirements = featureJob(`Requirements\n${text}`).requirements;
      const group = requirements.skills[0]!;

      expect(group.alternatives.map((item) => item.id)).toEqual(expected);

      expect(group.unresolvedAlternatives).toEqual([
        text.includes('Uncatalogued')
          ? 'UncataloguedFramework required'
          : 'another domain preferred',
      ]);

      expect(
        scoreJob({ ...featureJob(), requirements }, candidate(), [], false).fitScore,
      ).toBeNull();
    }
  });

  it.each([
    [
      'Reliability and consistency are important to a reliable employee.',
      ['system-reliability', 'data-consistency'],
    ],
    [
      'Review performance and correctness of theatre costumes.',
      ['system-performance', 'system-correctness'],
    ],
    [
      'Security staff protect visitor privacy at the mall.',
      ['software-security', 'privacy-engineering'],
    ],
    [
      'Performed medical testing and rapid prototyping of costumes.',
      ['software-testing', 'software-prototyping'],
    ],
    [
      'We introduced a new marketing initiative at local marketplaces.',
      ['initiative', 'marketplace-systems'],
    ],
    ['Experience selling goods at marketplaces.', ['marketplace-systems']],
  ] satisfies [string, string[]][])('rejects unrelated homonyms: %s', (text, rejected) => {
    for (const id of rejected) {
      expect(ids(text)).not.toContain(id);
    }
  });

  it('shares recognition with fictional resume analysis while retaining learning and denied evidence', () => {
    const analyzer = new AnalyzeResume([], () => new Date('2026-10-08T00:00:00Z'));

    const result = analyzer.execute({
      text: 'Experience\nEngineer | Fictional Systems\nJan 2020 - Dec 2023\nDeveloped APIs for backend systems.\nDebugged production systems and managed failovers.\nLearning ML infrastructure.\nNo experience with advertising systems.',
    });

    expect(result.skills.find((item) => item.id === 'api-development')?.status).toBe(
      'work_evidenced',
    );

    expect(result.skills.find((item) => item.id === 'ml-infrastructure')?.status).toBe('learning');
    expect(result.skills.find((item) => item.id === 'ads-systems')?.status).toBe('negated');
  });
});
