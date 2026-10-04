import { describe, expect, it } from 'vitest';
import { AnalyzeResume } from '../../application/resume/analyze-resume.js';
import { htmlJobDocumentReader } from '../../infrastructure/job-document.js';
import { featureJob, candidate, storedJob } from '../../test-fixtures/resume-matching.js';
import { extractRequirements } from './requirements.js';
import { scoreJob } from './score.js';
import { skillsInText } from '../resume/vocabulary.js';

const analyzer = new AnalyzeResume([], () => new Date('2026-10-02T00:00:00Z'));

const analyze = (text: string) => analyzer.execute({ text, analysisDate: '2026-10-02' });

describe('structured job requirements', () => {
  it('recovers fused labels, mixed preferences and target ranges without imposing a maximum', () => {
    const job = featureJob(
      'Qualifications3-5 years of software engineering experience, preferably supporting animation studios and pipelines',
    );

    expect(job.requirements.experience).toMatchObject([
      { minimumMonths: 36, maximumMonths: 60, importance: 'required' },
    ]);

    expect(
      job.requirements.skills.find((group) =>
        group.alternatives.some((item) => item.id === 'animation-pipelines'),
      )?.importance,
    ).toBe('preferred');

    const profile = candidate();

    profile.employment[0]!.end = 'Present';
    expect(scoreJob(job, profile, [], false).experience[0]?.status).toBe('met');
  });

  it('keeps abbreviation-bearing qualification sentences intact', () => {
    const requirements = featureJob(
      'Qualifications\nFamiliarity with emerging tools (e.g. Claude Code) and scalable workflows.',
    ).requirements;

    expect(requirements.clauses).toHaveLength(1);
    expect(requirements.clauses[0]?.evidence.excerpt).toContain('(e.g. Claude Code)');
  });

  it('keeps language OR lists with unknown terms and an independent AND requirement', () => {
    const requirements = featureJob(
      'What we look for:\nExperience in Java, Zig, or C++ and SQL.',
    ).requirements;

    expect(requirements.skills.map((group) => group.alternatives.map((item) => item.id))).toEqual([
      ['java', 'cpp'],
      ['sql'],
    ]);

    expect(requirements.skills[0]?.unresolvedAlternatives).toContain('Zig');
    expect(requirements.clauses[0]?.logic).toBe('all-of');

    const profile = {
      ...candidate(),
      skills: [
        { id: 'cpp', status: 'user_confirmed' as const },
        { id: 'sql', status: 'user_confirmed' as const },
      ],
    };

    expect(scoreJob({ ...featureJob(), requirements }, profile, [], false).requiredGaps).toBe(0);
  });

  it('recognizes SaaS/SOA as alternatives and distinguishes inference and training', () => {
    const requirements = featureJob(
      'Requirements\nExperience developing SaaS platforms or with SOA.\nFoundational understanding of inference and training technologies.',
    ).requirements;

    expect(requirements.skills.map((group) => group.alternatives.map((item) => item.id))).toEqual([
      ['saas', 'soa'],
      ['ml-inference'],
      ['model-training'],
    ]);
  });

  it('keeps independent professional and leadership thresholds with unknown activity tenure', () => {
    const job = featureJob(
      'Qualifications\n7+ years industry experience designing, building and supporting large scale systems in production.\n2+ years experience in leading a group of junior and senior engineers.',
    );

    expect(job.requirements.experience.map((entry) => [entry.minimumMonths, entry.scope])).toEqual([
      [84, 'professional'],
      [24, 'skill'],
    ]);

    expect(scoreJob(job, candidate(), [], false).experience[1]?.status).toBe('uncertain');
  });

  it('excludes ordinary excel and application recruiting, retaining candidate hiring', () => {
    const requirements = featureJob(
      'About us\nWe empower you with skills to excel in your career.\nQualifications\nExperience with high-throughput systems and GenAI-native applications.\nExperience hiring engineers.\nDuring the hiring process contact your recruiting partner for an accommodation.',
    ).requirements;

    const ids = requirements.skills.flatMap((item) => item.alternatives.map((skill) => skill.id));

    expect(ids).toContain('high-throughput');
    expect(ids).toContain('generative-ai');
    expect(ids).toContain('hiring');
    expect(ids).not.toContain('excel');
    expect(ids).not.toContain('recruiting');
    expect(requirements.clauses.at(-1)?.importance).toBe('contextual');
  });

  it('preserves nested HTML headings and ordinary bold keywords with canonical offsets', () => {
    const job = storedJob('nested');

    job.descriptionHtml =
      '<h2>Qualifications</h2><h3>Backend capabilities</h3><p>Experience with <strong>Python</strong>.</p><p><strong>Preferred qualifications:</strong>Go</p><h2>How to apply</h2><p>Contact your recruiting partner during the hiring process.</p>';

    const document = htmlJobDocumentReader.read(job);
    const python = document.blocks.find((block) => block.text.includes('Experience with'))!;

    expect(python.headingPath).toEqual(['Qualifications', 'Backend capabilities']);
    expect(document.text.slice(python.start, python.end)).toBe(python.text);

    const requirements = extractRequirements(job, document);

    expect(
      requirements.skills.map((group) => [group.importance, group.alternatives[0]?.id]),
    ).toEqual([
      ['required', 'python'],
      ['preferred', 'golang'],
    ]);

    for (const item of [
      ...requirements.skills,
      ...requirements.experience,
      ...requirements.clauses,
    ]) {
      expect(document.text.slice(item.evidence.start, item.evidence.end)).toBe(
        item.evidence.excerpt,
      );
    }
  });

  it('retains unknown required clauses and refers duplicate clauses to one comparison group', () => {
    const requirements = featureJob(
      'Requirements\nPython required.\nPython required.\nExperience with mysterious synthetic systems.',
    ).requirements;

    expect(requirements.skills).toHaveLength(1);

    expect(requirements.clauses.slice(0, 2).map((clause) => clause.groupIds[0])).toEqual([
      requirements.skills[0]!.id,
      requirements.skills[0]!.id,
    ]);

    expect(requirements.unparsed).toHaveLength(1);
    expect(scoreJob({ ...featureJob(), requirements }, candidate(), [], false).band).toBe('review');
  });

  it('retains unresolved alternatives in comparisons until a known option fully matches', () => {
    const job = featureJob('Requirements\nExperience with Python or MysteryLanguage.');
    const result = scoreJob(job, candidate(), [], false);

    expect(result.unresolvedRequirements).toBeGreaterThan(0);
    expect(result.band).toBe('review');
    expect(result.skills[0]?.unresolvedAlternatives).toContain('MysteryLanguage');
  });
});

describe('resume logical blocks and evidence provenance', () => {
  it('joins a wrapped bullet and maps the exact original span to its role', () => {
    const text =
      'Synthetic Candidate\nExperience\nSoftware Engineer | Fictional Labs\nJan 2020 - Present\n- Built distributed\nsystems in Go.\nSkills\nPython';

    const result = analyze(text);
    const skill = result.skills.find((item) => item.id === 'distributed-systems')!;

    expect(skill.status).toBe('work_evidenced');

    expect(skill.evidenceRefs?.[0]).toMatchObject({
      source: 'employment',
      roleId: result.employment[0]?.id,
      assertion: 'performed',
      action: 'build',
      lineIds: ['line-5', 'line-6'],
    });

    expect(text.slice(skill.evidence[0]!.start, skill.evidence[0]!.end)).toBe(
      'distributed\nsystems',
    );

    expect(result.skills.find((item) => item.id === 'python')?.evidenceRefs?.[0]?.assertion).toBe(
      'listed',
    );
  });

  it('preserves page/paragraph/column separators instead of merging unrelated fragments', () => {
    const result = analyze(
      'Experience\n- Built distributed\n\nsystems.\nSelected Projects\n- Implemented bounded retries.',
    );

    expect(result.skills.some((item) => item.id === 'distributed-systems')).toBe(false);

    expect(
      result.skills.find((item) => item.id === 'bounded-retries')?.evidenceRefs?.[0]?.source,
    ).toBe('project');

    expect(result.experience.professional.minimumMonths).toBe(0);
  });

  it('updates role provenance when reviewed employment is corrected to a project', () => {
    const text =
      'Experience\nSoftware Engineer | Fictional Labs\nJan 2020 - Dec 2023\nBuilt Python services.';

    const original = analyze(text);
    const role = original.employment[0]!;

    const reviewed = analyzer.execute({
      text,
      analysisDate: '2026-10-02',
      corrections: { employment: [{ ...role, kind: 'project' }] },
    });

    expect(reviewed.skills.find((item) => item.id === 'python')?.evidenceRefs?.[0]?.source).toBe(
      'project',
    );

    expect(reviewed.experience.professional.minimumMonths).toBe(0);
  });

  it('recognizes scoped AWS service lists without asserting services from generic AWS', () => {
    expect(skillsInText('AWS (S3, ECS, ElastiCache)').map((item) => item.id)).toEqual(
      expect.arrayContaining(['aws', 'aws-s3', 'aws-ecs', 'aws-elasticache']),
    );

    expect(skillsInText('AWS').map((item) => item.id)).toEqual(['aws']);
    expect(skillsInText('The ECS department enjoyed S3 vacation.')).toHaveLength(0);
  });

  it('extracts a location segment without including contact fields in its value', () => {
    const result = analyze(
      'Synthetic Candidate\nAmsterdam, Netherlands | synthetic@example.invalid | +00 0000\nSkills\nPython',
    );

    expect(result.location.value).toBe('Amsterdam, Netherlands');
  });

  it('keeps performed, observed, assisted, learning and negated assertions distinguishable', () => {
    const result = analyze(
      'Projects\nBuilt Python services. Observed a team using Rust.\nAssisted a team using Java.\nLearning Kotlin.\nNo experience with Scala.',
    );

    const assertions = Object.fromEntries(
      result.skills.map((skill) => [skill.id, skill.evidenceRefs?.[0]?.assertion]),
    );

    expect(assertions).toMatchObject({
      python: 'performed',
      rust: 'observed',
      java: 'assisted',
      kotlin: 'learning',
      scala: 'negated',
    });

    expect(result.skills.find((skill) => skill.id === 'python')?.evidenceRefs?.[0]?.action).toBe(
      'build',
    );
  });
});
