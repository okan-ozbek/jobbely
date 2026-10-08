import { useEffect, useState } from 'react';
import { compareJobResume } from '../../api/client.js';
import { LoadingSkeleton } from '../../components/LoadingSkeleton.js';
import type { Job, JobMatchResponse, ResumeAnalysis } from '../../api/client.js';
import { matchProfile } from './match-profile.js';
import { ConfidenceLegend } from './MatchEvidence.js';
import { HighlightedDescription } from './HighlightedDescription.js';
import { MatchMetrics } from './MatchMetrics.js';

export function JobProfileComparison({
  job,
  analysis,
  reviewResume,
}: {
  job: Job;
  analysis: ResumeAnalysis | null;
  reviewResume: () => void;
}) {
  const [response, setResponse] = useState<{
    jobId: string;
    analysis: ResumeAnalysis;
    data: JobMatchResponse;
  } | null>(null);

  const [error, setError] = useState('');

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
        <div className="comparison-heading">
          <h2>Your resume against this role</h2>
          {data && (
            <span className="resume-status">
              {data.comparison.band === 'review'
                ? data.comparison.fitScore === null
                  ? 'Score unavailable'
                  : 'Partial assessment'
                : data.comparison.band}
            </span>
          )}
        </div>
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
              <LoadingSkeleton
                kind="text"
                label="Comparing your reviewed profile…"
              />
            ) : (
              <>
                <MatchMetrics comparison={data.comparison} />
                <p className="small-note">
                  {data.comparison.requiredGaps} recognized required gaps ·{' '}
                  {data.comparison.unresolvedRequirements} unassessable qualifications
                </p>
                <details className="comparison-source small-note">
                  <summary>
                    {data.recommendationEligible
                      ? 'Available for matching'
                      : 'Description comparison only'}{' '}
                    · Source checked{' '}
                    {new Date(data.lastSeenAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </summary>
                  <p>
                    {data.availability} Checked {new Date(data.lastSeenAt).toLocaleString()}.
                  </p>
                </details>
              </>
            )}
          </>
        )}
      </section>
      <HighlightedDescription
        html={job.descriptionHtml}
        data={data}
        analysis={analysis}
        highlight
      />
    </div>
  );
}
