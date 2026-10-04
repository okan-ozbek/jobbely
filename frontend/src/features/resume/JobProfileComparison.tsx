import { reviewQuestions } from './semantic-review.js';
import { SkillQuestions } from './SkillQuestions.js';
import { useEffect, useState } from 'react';
import { compareJobResume, getRequirements } from '../../api/client.js';
import type {
  ConceptReview,
  Job,
  JobMatchResponse,
  JobRequirements,
  ResumeAnalysis,
} from '../../api/client.js';
import { matchProfile } from './match-profile.js';
import { ConfidenceLegend, MatchEvidence } from './MatchEvidence.js';
import { QualificationGroups } from './QualificationGroups.js';

export function JobProfileComparison({
  job,
  analysis,
  reviewResume,
  reviewSignal,
}: {
  job: Job;
  analysis: ResumeAnalysis | null;
  reviewResume: () => void;
  reviewSignal: (review: ConceptReview) => void;
}) {
  const [response, setResponse] = useState<{
    jobId: string;
    analysis: ResumeAnalysis;
    data: JobMatchResponse;
  } | null>(null);

  const [error, setError] = useState('');
  const [highlight, setHighlight] = useState(true);
  const [original, setOriginal] = useState(false);
  const [reading, setReading] = useState<{ jobId: string; data: JobRequirements } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setReading(null);
    setOriginal(false);

    void getRequirements(job.id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setReading({ jobId: job.id, data: value });
        }
      })
      .catch(() => {
        /* The original description remains available. */
      });

    return () => controller.abort();
  }, [job.id]);

  useEffect(() => {
    setResponse(null);
    setError('');

    if (!analysis) {
      return;
    }

    const controller = new AbortController();

    void compareJobResume(job.id, matchProfile(analysis), controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResponse({ jobId: job.id, analysis, data });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Could not compare this profile. The original description is available below.');
        }
      });

    return () => controller.abort();
  }, [job.id, analysis]);

  const data = response?.jobId === job.id && response.analysis === analysis ? response.data : null;

  return (
    <div>
      <section
        className="job-profile-comparison"
        aria-label="Resume comparison"
      >
        <h2>Your resume against this role</h2>
        {!analysis ? (
          <>
            <p>
              Review your resume to see direct matches, related evidence and gaps highlighted in
              this description.
            </p>
            <button
              className="resume-secondary-button"
              onClick={reviewResume}
            >
              Review resume
            </button>
          </>
        ) : (
          <>
            <ConfidenceLegend />
            {error ? (
              <p role="alert">{error}</p>
            ) : !data ? (
              <p role="status">Comparing your reviewed profile…</p>
            ) : (
              <>
                <p className="small-note">
                  {data.availability} Checked {new Date(data.lastSeenAt).toLocaleString()}.
                  Qualifications carry the evidence colors; company and application text remains
                  additional information.
                  {data.comparison.band === 'review'
                    ? ' This reading needs review.'
                    : ` Fit: ${data.comparison.band}.`}{' '}
                  Evidence completeness {data.comparison.completeness}% ·{' '}
                  {data.comparison.unresolvedRequirements} unresolved requirement(s).
                </p>
                <SkillQuestions
                  questions={reviewQuestions(data.comparison.skills)}
                  answer={reviewSignal}
                />
                <label className="resume-checkbox">
                  <input
                    type="checkbox"
                    checked={highlight}
                    onChange={(event) => setHighlight(event.target.checked)}
                  />
                  Highlight recognized skills and activities
                </label>
                <details>
                  <summary>
                    Requirement evidence · {data.comparison.requiredGaps} recognized required gap(s)
                  </summary>
                  <MatchEvidence
                    comparison={data.comparison}
                    analysis={analysis ?? undefined}
                  />
                </details>
              </>
            )}
          </>
        )}
      </section>
      <button
        type="button"
        className="resume-secondary-button"
        onClick={() => setOriginal(!original)}
      >
        {original ? 'Show grouped qualifications' : 'Show original description'}
      </button>
      {!original && (data?.requirements ?? (reading?.jobId === job.id ? reading.data : null)) ? (
        <QualificationGroups
          requirements={data?.requirements ?? reading!.data}
          annotations={highlight ? (data?.skills ?? []) : []}
        />
      ) : (
        <article
          className="description"
          dangerouslySetInnerHTML={{ __html: job.descriptionHtml }}
        />
      )}
    </div>
  );
}
