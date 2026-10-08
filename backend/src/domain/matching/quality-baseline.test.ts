import { describe, expect, it } from 'vitest';
import { candidate, featureJob } from '../../test-fixtures/resume-matching.js';
import { htmlJobDocumentReader } from '../../infrastructure/job-document.js';
import { skillsInText } from '../resume/vocabulary.js';
import { extractRequirements } from './requirements.js';
import { scoreJob } from './score.js';

// Fictional profiles and a public-role paraphrase. No candidate document is retained.
const mobileRole = `The Community You Will Join
Our software team supports a consumer application.
A Typical Day
Build automated tests and integrate them into CI/CD pipelines.
Learn and apply AI-assisted tooling (LLMs) to test creation.
Your Expertise
1–2 years of experience in software development.
Recent graduates with relevant internship or project experience are welcome.
Foundational knowledge of at least one programming language (e.g., JavaScript/TypeScript, Python, Kotlin, Swift, or Java).
Some exposure to writing automated tests or working with a testing framework (e.g., Playwright, Cypress, Espresso, XCUITest) through work, internships, or personal projects.
Understanding of basic testing concepts, and eagerness to learn the testing pyramid, CI/CD, and quality best practices.
Understanding that test quality is measurable, with interest in concepts like coverage, flaky test rate, and suite execution time.
Curiosity about applying AI/LLMs to testing and developer productivity.
Comfortable collaborating in English.
Bachelor’s degree in computer science or equivalent`;

describe('honest qualification baseline', () => {
  it('retains the previously omitted mobile qualifications without claiming perfect fit', () => {
    const job = featureJob(mobileRole);
    const result = scoreJob(job, candidate(), [], false);
    const required = job.requirements.skills.filter((group) => group.importance === 'required');

    expect(required.flatMap((group) => group.alternatives.map((item) => item.id))).toEqual(
      expect.arrayContaining(['test-automation', 'software-testing', 'test-quality']),
    );

    expect(job.requirements.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'qualification', importance: 'required' }),
        expect.objectContaining({ kind: 'language', importance: 'required' }),
      ]),
    );

    expect(result.education[0]?.status).toBe('uncertain');
    expect(result.requiredGaps).toBeGreaterThan(0);
    expect(result.unresolvedRequirements).toBeGreaterThan(0);
    expect(result.fitScore).toBe(35);
    expect(result.band).toBe('review');
    expect(result.assessmentCoverage.total).toBeGreaterThan(2);

    const testingGroup = required.filter((group) =>
      group.alternatives.some((item) => item.id === 'espresso'),
    );

    expect(testingGroup).toHaveLength(1);
    expect(testingGroup[0]?.logic).toBe('any-of');

    for (const learning of ['ci-cd', 'llm', 'testing-pyramid']) {
      expect(required.flatMap((group) => group.alternatives.map((item) => item.id))).not.toContain(
        learning,
      );
    }

    expect(
      job.requirements.clauses.find((clause) => clause.evidence.excerpt.startsWith('Some exposure'))
        ?.exampleIds,
    ).toEqual(['playwright', 'cypress', 'espresso', 'xcuitest']);
  });

  it('gives every non-heading sentence a disposition and preserves its exact canonical evidence', () => {
    const job = featureJob(mobileRole);
    const document = htmlJobDocumentReader.read({ descriptionText: mobileRole });

    expect(job.requirements.clauses.length).toBeGreaterThan(10);

    expect(job.requirements.clauses.some((clause) => clause.disposition === 'needs-review')).toBe(
      true,
    );

    for (const clause of job.requirements.clauses) {
      expect(document.text.slice(clause.evidence.start, clause.evidence.end)).toBe(
        clause.evidence.excerpt,
      );

      expect(clause.disposition).toBeTruthy();
    }

    const learning = job.requirements.clauses.find((clause) =>
      clause.evidence.excerpt.startsWith('eagerness'),
    );

    expect(learning).toMatchObject({ importance: 'contextual', disposition: 'contextual' });
    expect(learning?.objectIds).toContain('ci-cd');
  });

  it('keeps independent unknown requirements visible even when recognized skills are fully met', () => {
    const result = scoreJob(
      featureJob('Your Expertise\nTypeScript required.\nUnderstanding of UncataloguedTestMethod.'),
      candidate(),
      [],
      false,
    );

    expect(result).toMatchObject({ fitScore: 62.5, band: 'review', unresolvedRequirements: 1 });
    expect(result.job.requirements.clauses[1]?.disposition).toBe('needs-review');
  });

  it('recognizes real named test tools and rejects coffee and non-software testing', () => {
    expect(
      skillsInText('Android UI tests with Espresso and XCUITest').map((item) => item.id),
    ).toEqual(expect.arrayContaining(['espresso', 'xcuitest']));

    const nonSoftware = skillsInText('Served espresso and performed medical testing.').map(
      (item) => item.id,
    );

    expect(nonSoftware).not.toContain('espresso');
    expect(nonSoftware).not.toContain('software-testing');
  });

  it('retains headerless qualifications in copied job text and keeps company tooling contextual', () => {
    const job = featureJob(
      'Our platform uses CI/CD and LLMs.\nSome exposure to writing automated tests.\nUnderstanding of basic testing concepts.\nBachelor’s degree in computer science or equivalent.',
    );

    expect(
      job.requirements.skills
        .filter((group) => group.importance === 'required')
        .flatMap((group) => group.alternatives.map((item) => item.id)),
    ).toEqual(expect.arrayContaining(['test-automation', 'software-testing']));

    expect(job.requirements.constraints[0]?.importance).toBe('required');
    expect(job.requirements.clauses[0]?.disposition).toBe('contextual');
    expect(scoreJob(job, candidate(), [], false).fitScore).toBe(12.5);
  });

  it('treats illustrative language alternatives as one requirement', () => {
    const job = featureJob(
      'Your Expertise\nKnowledge of a programming language (e.g., Java, Kotlin, Python).',
    );

    expect(job.requirements.skills).toHaveLength(1);

    expect(job.requirements.skills[0]?.alternatives.map((item) => item.id)).not.toContain(
      'software-testing',
    );

    expect(job.requirements.skills[0]?.logic).toBe('any-of');
    expect(scoreJob(job, candidate(), [], false).requiredGaps).toBe(0);
  });

  it('accepts a named testing framework OR automated-test evidence without demanding every example', () => {
    const job = featureJob(
      'Your Expertise\nSome exposure to writing automated tests or working with a testing framework (e.g., Playwright, Cypress, Espresso, XCUITest).',
    );

    expect(job.requirements.skills).toHaveLength(1);

    for (const id of ['espresso', 'test-automation']) {
      const result = scoreJob(
        job,
        { ...candidate(), skills: [{ id, status: 'user_confirmed' }] },
        [],
        false,
      );

      expect(result.skills[0]?.credit).toBe(1);
      expect(result.requiredGaps).toBe(0);
    }

    expect(scoreJob(job, candidate(), [], false).assessmentCoverage.percentage).toBeLessThan(100);

    expect(
      scoreJob(
        job,
        { ...candidate(), skills: [{ id: 'software-testing', status: 'user_confirmed' }] },
        [],
        false,
      ).skills[0]?.credit,
    ).toBe(0);
  });

  it('keeps undefined graduate and degree equivalence paths uncertain instead of rejecting or granting them', () => {
    const profile = {
      ...candidate(),
      employment: [],
      education: [
        {
          level: 'bachelor' as const,
          field: 'business' as const,
          completion: 'completed' as const,
        },
      ],
    };

    const result = scoreJob(
      featureJob(
        'Your Expertise\n1–2 years of experience in software development.\nRecent graduates with relevant internship or project experience are welcome.\nBachelor’s degree in computer science or equivalent',
      ),
      profile,
      [],
      false,
    );

    expect(result.experience[0]?.status).toBe('uncertain');
    expect(result.education[0]?.status).toBe('uncertain');
    expect(result.fitScore).toBe(25);
    expect(result.requiredGaps).toBe(0);
  });

  it('keeps genuine complete comparisons and separates role relevance from qualification fit', () => {
    const profile = candidate();

    const complete = scoreJob(
      featureJob('Your Expertise\nTypeScript required.'),
      profile,
      [],
      false,
    );

    expect(complete.fitScore).toBe(100);
    profile.skills.push({ id: 'scala', status: 'user_confirmed' });

    const plain = scoreJob(
      featureJob('Your Expertise\nTypeScript required.\nDocker required.'),
      profile,
      [],
      false,
    );

    const contextual = scoreJob(
      featureJob(
        'Your Expertise\nTypeScript required.\nDocker required.\nA Typical Day\nBuild services with Scala.',
      ),
      profile,
      [],
      false,
    );

    expect(contextual.baseScore).toBeGreaterThan(plain.baseScore);
    expect(contextual.fitScore).toBe(plain.fitScore);
    expect(contextual.fitScore).toBeLessThan(100);
  });

  it('accepts explicitly alternative degree fields without silently broadening them to any STEM degree', () => {
    const job = featureJob(
      'Your Expertise\nBachelor’s degree in computer science/engineering or equivalent.',
    );

    for (const field of ['computer-science', 'engineering', 'physics'] as const) {
      const result = scoreJob(
        job,
        { ...candidate(), education: [{ level: 'bachelor', field, completion: 'completed' }] },
        [],
        false,
      );

      expect(result.education[0]?.status).toBe(field === 'physics' ? 'uncertain' : 'met');
    }
  });

  it('honors HTML section boundaries without leaking qualifications into an unfamiliar peer heading', () => {
    const document = htmlJobDocumentReader.read({
      descriptionText: '',
      descriptionHtml:
        '<h2>Your Expertise</h2><p>TypeScript required.</p><h2>A glimpse behind the scenes</h2><p>Our office serves espresso.</p><h2>A Typical Day</h2><p>Build automated tests.</p>',
    });

    const requirements = extractRequirements(
      {
        descriptionText: document.text,
        contentHash: 'synthetic',
        classification: {
          category: 'engineering',
          method: 'source_mapping',
          rule: 'test',
          evidence: '',
          version: 'test',
        },
        locations: [],
        workplace: 'unknown',
      },
      document,
    );

    expect(requirements.clauses.map((clause) => clause.importance)).toEqual([
      'required',
      'contextual',
      'contextual',
    ]);

    expect(requirements.skills.filter((group) => group.importance === 'required')).toHaveLength(1);
  });
});
