import {
  evaluateInterpretation,
  localizationMetrics,
} from '../../domain/matching/semantic-evaluation.js';
import type { QualificationLabel } from '../../domain/matching/semantic-evaluation.js';
import type { SemanticJobInput } from '../../domain/matching/semantic-model.js';
import { SemanticExtractionError } from '../../ports/semantic-extractor.js';
import type { SemanticJobExtractor } from '../../ports/semantic-extractor.js';

export interface SemanticEvaluationSample {
  id: string;
  input: SemanticJobInput;
  labels: QualificationLabel[];
}

export async function evaluateSemantics(
  extractor: SemanticJobExtractor,
  samples: SemanticEvaluationSample[],
  signal?: AbortSignal,
) {
  const cases: {
    id: string;
    state: 'evaluated' | 'failed';
    metrics: ReturnType<typeof evaluateInterpretation> | null;
    error: string | null;
  }[] = [];

  const counts = { predicted: 0, expected: 0, matched: 0 };
  let logicCorrect = 0;
  let logicAssessed = 0;
  let durationCorrect = 0;
  let durationExpected = 0;

  for (const sample of samples) {
    signal?.throwIfAborted();

    try {
      const extraction = await extractor.extract(sample.input, signal);
      const metrics = evaluateInterpretation(extraction, sample.labels);

      counts.predicted += metrics.localization.predicted;
      counts.expected += metrics.localization.expected;
      counts.matched += metrics.localization.matched;
      logicCorrect += metrics.logic.correct;
      logicAssessed += metrics.logic.assessed;
      durationCorrect += metrics.duration.correct;
      durationExpected += metrics.duration.expected;
      cases.push({ id: sample.id, state: 'evaluated', metrics, error: null });
    } catch (error) {
      if (signal?.aborted) {
        signal.throwIfAborted();
      }

      // Failed cases still contribute their gold requirements to recall.
      counts.expected += sample.labels.length;
      durationExpected += sample.labels.filter((label) => label.minimumMonths !== null).length;

      cases.push({
        id: sample.id,
        state: 'failed',
        metrics: null,
        error: error instanceof SemanticExtractionError ? error.code : 'invalid-output',
      });
    }
  }

  return {
    identity: extractor.identity,
    cases,
    summary: {
      evaluated: cases.filter((item) => item.state === 'evaluated').length,
      failed: cases.filter((item) => item.state === 'failed').length,
      needsReview: cases.filter((item) => item.metrics?.needsReview).length,
      localization: localizationMetrics(counts),
      logic: { correct: logicCorrect, assessed: logicAssessed },
      duration: { correct: durationCorrect, expected: durationExpected },
    },
  };
}
