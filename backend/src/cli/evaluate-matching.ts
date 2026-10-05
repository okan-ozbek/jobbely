import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { evaluateSemantics } from '../application/resume/evaluate-semantics.js';
import { createExperimentalJobExtractor } from '../bootstrap-semantics.js';
import { RulesJobExtractor } from '../infrastructure/semantics/rules.js';
import { SemanticExtractionError } from '../ports/semantic-extractor.js';
import {
  evaluationCorpusVersion,
  evaluationSample,
  semanticDevelopmentCases,
} from '../test-fixtures/semantic-evaluation.js';
import {
  baselineResumeActivities,
  sparsePythonActivities,
} from '../test-fixtures/matching-baseline-probes.js';
import { AnalyzeResume } from '../application/resume/analyze-resume.js';
import { scoreJob } from '../domain/matching/score.js';
import { featureJob } from '../test-fixtures/resume-matching.js';

function legacyResumeProbes() {
  const analyzer = new AnalyzeResume([], () => new Date('2026-10-04T12:00:00Z'));

  const profile = (activity: string) =>
    analyzer.execute({
      text: `Experience\nSoftware Engineer | Fictional Company\nJan 2020 - Present\n${activity}`,
      analysisDate: '2026-10-04',
    });

  return {
    recognition: baselineResumeActivities.map(({ id, activity }) => ({
      id,
      concepts: profile(activity).skills.map((skill) => skill.id),
    })),
    sparseJobScores: sparsePythonActivities.map(({ id, activity }) => {
      const analysis = profile(activity);

      const result = scoreJob(
        featureJob('Requirements\nExperience with Python.'),
        analysis,
        [],
        false,
      );

      return {
        id,
        score: result.baseScore,
        assessmentCoverage: result.assessmentCoverage,
        band: result.band,
      };
    }),
  };
}

const { values } = parseArgs({ options: { strategy: { type: 'string', default: 'rules' } } });

if (!['rules', 'ollama'].includes(values.strategy!)) {
  throw new Error('Use --strategy rules or --strategy ollama.');
}

const controller = new AbortController();

const cancel = () => controller.abort();

process.once('SIGINT', cancel);

try {
  const samples = semanticDevelopmentCases.map((sample) => ({
    id: sample.id,
    ...evaluationSample(sample),
  }));

  const baseline = await evaluateSemantics(new RulesJobExtractor(), samples, controller.signal);

  const experimental =
    values.strategy === 'ollama'
      ? await evaluateSemantics(
          await createExperimentalJobExtractor(controller.signal),
          samples,
          controller.signal,
        )
      : null;

  console.log(
    JSON.stringify(
      {
        corpus: {
          version: evaluationCorpusVersion,
          digest: createHash('sha256')
            .update(JSON.stringify(semanticDevelopmentCases))
            .digest('hex'),
          cases: samples.length,
          labels: 'agent-authored-development',
          heldOut: false,
        },
        limitations: [
          'Localization and logic metrics do not measure semantic entailment.',
          'Independent human review, held-out ranking and model calibration remain pending.',
        ],
        baseline,
        experimental,
        legacyResumeProbes: legacyResumeProbes(),
      },
      null,
      2,
    ),
  );

  if (baseline.summary.failed || experimental?.summary.failed) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    JSON.stringify({
      code: controller.signal.aborted
        ? 'cancelled'
        : error instanceof SemanticExtractionError
          ? error.code
          : 'evaluation-failed',
      message:
        'Could not complete semantic evaluation. Local model evaluation requires a reachable Ollama runtime, explicit SEMANTIC_JOB_MODEL and its installed SEMANTIC_JOB_MODEL_DIGEST.',
    }),
  );

  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', cancel);
}
