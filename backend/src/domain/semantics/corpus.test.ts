import { describe, expect, it } from 'vitest';
import { AnalyzeResume } from '../../application/resume/analyze-resume.js';
import { featureJob, candidate } from '../../test-fixtures/resume-matching.js';
import { recognizeConcepts } from './recognize.js';
import { PublicVocabularyAudit } from './vocabulary-audit.js';
import { scoreJob } from '../matching/score.js';
import { projectSkills, skillMatch } from '../matching/skill-relations.js';

const analyzer = new AnalyzeResume([], () => new Date('2026-10-08T00:00:00Z'));

const ids = (text: string, list = false) =>
  recognizeConcepts(text, list).map((mention) => mention.id);

describe('reviewed corpus vocabulary', () => {
  const contrasts: [string, string, string][] = [
    [
      'chef',
      'Used Chef and Terraform for infrastructure automation.',
      'Hired a chef for our company kitchen.',
    ],
    [
      'puppet',
      'Used Puppet for configuration management.',
      'Created a puppet for the office theatre.',
    ],
    ['packer', 'Used Packer to bake machine images.', 'Hired a packer for warehouse duties.'],
    [
      'sas',
      'Used SAS and Python for statistical analysis.',
      'Coach junior SAs on customer engagement.',
    ],
    [
      'oracle-database',
      'Used Oracle and PostgreSQL databases.',
      'We use Oracle ERP and NetSuite for procurement.',
    ],
    ['aws-s3', 'Stored data in S3 buckets.', 'Diagnosed a Samsung Galaxy S3 handset.'],
    [
      'gcp-storage',
      'Built Kafka connectors to GCS and BigQuery.',
      'Validate schedules from developers, GCs, and third-party partners.',
    ],
    [
      'iceberg',
      'Built Iceberg table management for Spark and Trino.',
      'This is the tip of the iceberg for software development.',
    ],
    [
      'swift',
      'Built iOS applications in Swift.',
      'Provide SWIFT messages confirming client payments.',
    ],
    [
      'swift',
      'Developed a Swift framework for mobile devices.',
      'Demonstrated swift execution and stakeholder communication.',
    ],
    ['spring', 'Developed Java services with Spring.', 'Organized a spring event for customers.'],
    [
      'rails',
      'Built Ruby on Rails applications.',
      'Designed low-voltage rails for multilayer boards.',
    ],
    [
      'ray',
      'Used Ray for distributed ML training with PyTorch.',
      'Built GPU ray-tracing platforms.',
    ],
    [
      'snowflake',
      'Built SQL pipelines in Snowflake.',
      'Join us to build your future at Snowflake.',
    ],
    [
      'workday',
      'Configured Workday Financials integrations.',
      'You have found a match in Workday; join our company.',
    ],
    [
      'greenhouse',
      'Used Greenhouse as our applicant tracking system.',
      'Managed a greenhouse for growing plants.',
    ],
    [
      'servicenow',
      'Configured ServiceNow ITSM workflows.',
      'Join the ServiceNow family and build your career.',
    ],
    [
      'illustrator',
      'Used Adobe Illustrator and Photoshop.',
      'Hired a talented graphic designer and illustrator.',
    ],
    ['blender', 'Used Blender for 3D rendering.', 'Installed a blender in the office kitchen.'],
    ['llm', 'Evaluated LLM inference and generative models.', 'Completed an LLM degree in law.'],
    [
      'rag',
      'Built RAG retrieval pipelines with vector embeddings.',
      'Presented a red amber green RAG status report.',
    ],
    ['r', 'Used R and Python for statistical analysis.', 'Managed our R&D programming team.'],
    [
      'tls',
      'Configured TLS certificates for HTTPS traffic.',
      'Partner with senior TLs and Engineering Managers.',
    ],
    [
      'technical-documentation',
      'Wrote documentation for APIs and software developers.',
      'Maintain immigration and legal documentation.',
    ],
    [
      'safe-defaults',
      'Provided safe defaults for platform configuration.',
      'We value safe defaults for planning office events.',
    ],
    [
      'sales-pipeline',
      'Owned sales forecasting and pipeline management.',
      'Owned water pipeline management and maintenance.',
    ],
    [
      'physical-design',
      'Automated physical design for RTL and silicon chips.',
      'Created a physical design for our office seating plan.',
    ],
  ];

  for (const [id, positive, negative] of contrasts) {
    it(`${id}: ${negative}`, () => {
      expect(ids(positive)).toContain(id);
      expect(ids(negative)).not.toContain(id);
    });
  }

  it('does not borrow a homonym context from an unrelated sentence', () => {
    expect(ids('Built Java backend services. Organized a spring picnic.')).not.toContain('spring');

    expect(ids('Used SQL for analytics. Join us to build a future at Snowflake.')).not.toContain(
      'snowflake',
    );

    expect(ids('Managed cloud infrastructure. Validate schedule data from GCs.')).not.toContain(
      'gcp-storage',
    );
  });

  it('recognizes skills across functions and retains exact original alias offsets', () => {
    const text =
      'Used Next.js, ASP.NET Core, scikit-learn, System Verilog, Jira, GAAP and Google Sheets.';

    expect(ids(text)).toEqual(
      expect.arrayContaining([
        'nextjs',
        'aspnet',
        'scikit-learn',
        'systemverilog',
        'jira',
        'gaap',
        'google-sheets',
      ]),
    );

    expect(ids(text)).not.toContain('dotnet');

    for (const mention of recognizeConcepts(text)) {
      expect(text.slice(mention.position, mention.position + mention.length).length).toBe(
        mention.length,
      );
    }

    expect(ids('Used Unity Catalog to manage data.')).not.toContain('unity-engine');
    expect(ids('Used ONNX Runtime to serve models.')).not.toContain('onnx');
  });

  it('recognizes the missing ingestion capabilities without inventing a datastore', () => {
    const text = `Responsibilities
Build connectors for Kafka, S3, GCS, Iceberg and other data stores.
Improve platform self-service through clear APIs, safe defaults, automated provisioning, documentation and dead-letter queues.
Work collaboratively with engineers and stakeholders across Infrastructure and Product to align roadmaps.
Qualifications
Experience with Python or Scala required.`;

    const requirements = featureJob(text).requirements;
    const groups = requirements.skills;

    for (const id of [
      'aws-s3',
      'gcp-storage',
      'iceberg',
      'data-integration',
      'api-design',
      'safe-defaults',
      'automated-provisioning',
      'technical-documentation',
      'dead-letter-queues',
      'stakeholder-communication',
    ]) {
      expect(
        groups.find((group) => group.alternatives.some((alternative) => alternative.id === id))
          ?.importance,
      ).toBe('contextual');
    }

    expect(groups.flatMap((group) => group.alternatives.map((item) => item.id))).not.toContain(
      'postgresql',
    );

    expect(requirements.experience).toHaveLength(0);
  });

  it('shares recognition with resume evidence and preserves negation, learning and contextual credit', () => {
    for (const [prefix, status] of [
      ['Used', 'work_evidenced'],
      ['Never used', 'negated'],
      ['Learning', 'learning'],
      ['Our platform uses', 'mentioned'],
    ] as const) {
      const analysis = analyzer.execute({
        text: `Experience\nEngineer | Fictional Labs\nJan 2020 - Dec 2025\n${prefix} GCS cloud storage and Iceberg tables.`,
      });

      expect(analysis.skills.find((skill) => skill.id === 'gcp-storage')?.status).toBe(status);
      expect(analysis.skills.find((skill) => skill.id === 'iceberg')?.status).toBe(status);
    }

    const analysis = analyzer.execute({
      text: 'Experience\nEngineer | Fictional Labs\nJan 2020 - Dec 2025\nWorked with stakeholders on platform migrations.',
    });

    expect(
      analysis.competencies.find((skill) => skill.id === 'stakeholder-communication')?.status,
    ).toBe('work_evidenced');

    const projection = projectSkills([{ id: 'aws', status: 'user_confirmed' }]);

    expect(skillMatch(projection, 'gcp-storage').credit).toBe(0);
    expect(skillMatch(projection, 'iceberg').credit).toBe(0);
  });

  it('does not award activity credit for never-performed work or documentation', () => {
    const analysis = analyzer.execute({
      text: 'Experience\nEngineer | Fictional Labs\nJan 2020 - Dec 2025\nNever worked with stakeholders.\nNever built connectors to other data stores.\nNever wrote API documentation.',
    });

    expect(
      analysis.competencies.find((skill) => skill.id === 'stakeholder-communication')?.status,
    ).toBe('negated');

    expect(analysis.skills.find((skill) => skill.id === 'data-integration')?.status).toBe(
      'negated',
    );

    expect(analysis.skills.find((skill) => skill.id === 'technical-documentation')?.status).toBe(
      'negated',
    );

    const positive = analyzer.execute({
      text: 'Experience\nEngineer | Fictional Labs\nJan 2020 - Dec 2025\nNever failed to use GCS cloud storage correctly.',
    });

    expect(positive.skills.find((skill) => skill.id === 'gcp-storage')?.status).toBe(
      'work_evidenced',
    );
  });

  it('keeps alternatives, mandatory gaps, information exclusions and unknown requirements', () => {
    const job = featureJob(
      'Qualifications\nExperience with Snowflake SQL or BigQuery required.\nExpertise with an unspecified proprietary datastore required.\nBenefits\nWe provide Jira training.\nEqual opportunity\nAll qualified applicants may use Google Sheets during the hiring process.',
    );

    const match = scoreJob(
      job,
      { ...candidate(), skills: [{ id: 'gcp-bigquery', status: 'user_confirmed' }] },
      [],
      false,
    );

    expect(job.requirements.skills[0]?.alternatives.map((item) => item.id)).toContain('snowflake');

    expect(
      job.requirements.skills.flatMap((group) => group.alternatives.map((item) => item.id)),
    ).not.toEqual(expect.arrayContaining(['jira', 'google-sheets']));

    expect(job.requirements.unparsed.length).toBeGreaterThan(0);
    expect(match.band).toBe('review');

    const missing = scoreJob(
      featureJob('Qualifications\nExperience with Apache Iceberg required.'),
      candidate(),
      [],
      false,
    );

    expect(missing.requiredGaps).toBeGreaterThan(0);
  });
});

describe('public vocabulary discovery', () => {
  it('counts all descriptions, distinguishes exclusions, and never merges across recognized claims', () => {
    const audit = new PublicVocabularyAudit();

    const descriptionText =
      'Qualifications\nExperience with NovelDB and mystic Python vaults.\nBenefits\nFree kitchen snacks.\nEqual opportunity\nAll qualified applicants are welcome.';

    audit.add({ id: 'a', companySlug: 'fictional-a', category: 'engineering', descriptionText });
    audit.add({ id: 'b', companySlug: 'fictional-b', category: 'sales', descriptionText });
    audit.add({ id: 'c', companySlug: 'fictional-a', category: 'people', descriptionText: '' });

    audit.add({
      id: 'd',
      companySlug: 'fictional-a',
      category: 'engineering',
      descriptionText: 'x'.repeat(200_001),
    });

    expect(() => audit.report()).toThrow('two complete passes');
    audit.startReview(1, 100);
    audit.add({ id: 'a', companySlug: 'fictional-a', category: 'engineering', descriptionText });
    audit.add({ id: 'b', companySlug: 'fictional-b', category: 'sales', descriptionText });
    audit.add({ id: 'c', companySlug: 'fictional-a', category: 'people', descriptionText: '' });

    audit.add({
      id: 'd',
      companySlug: 'fictional-a',
      category: 'engineering',
      descriptionText: 'x'.repeat(200_001),
    });

    const report = audit.report();

    expect(report).toMatchObject({
      postings: 4,
      companies: 2,
      emptyDescriptions: 1,
      truncatedDescriptions: 1,
    });

    expect(report.candidates.find((entry) => entry.term === 'noveldb')).toMatchObject({
      postings: 2,
      companies: ['fictional-a', 'fictional-b'],
    });

    expect(report.candidates.map((entry) => entry.term)).not.toEqual(
      expect.arrayContaining(['kitchen', 'mystic vaults', 'python', 'applicants']),
    );

    expect(report.recognizedPostings.python).toBe(2);
    expect(report.excludedBlocks).toBeGreaterThan(0);
    expect(ids('Experience with NovelDB.')).toHaveLength(0);
    expect(() => audit.startReview()).toThrow('one bounded discovery pass');
  });
});
