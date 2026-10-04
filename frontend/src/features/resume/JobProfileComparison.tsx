import { useEffect, useState } from 'react';
import { compareJobResume } from '../../api/client.js';
import type { Job, JobMatchResponse, ResumeAnalysis } from '../../api/client.js';
import { matchProfile } from './match-profile.js';
import { ConfidenceLegend } from './MatchEvidence.js';
import { HighlightedDescription } from './HighlightedDescription.js';

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
  const [highlight, setHighlight] = useState(true);

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
                  {data.availability} Checked {new Date(data.lastSeenAt).toLocaleString()}. Match{' '}
                  {data.comparison.baseScore}%.
                  {data.comparison.band === 'review'
                    ? ' This reading needs review.'
                    : ` Fit: ${data.comparison.band}.`}{' '}
                  Evidence completeness {data.comparison.completeness}% ·{' '}
                  {data.comparison.unresolvedRequirements} unresolved requirement(s).
                </p>
                <label className="resume-checkbox">
                  <input
                    type="checkbox"
                    checked={highlight}
                    onChange={(event) => setHighlight(event.target.checked)}
                  />
                  Highlight recognized skills and activities
                </label>
                <p className="small-note">
                  Hover, focus or tap a highlighted skill to see why it matches.
                </p>
              </>
            )}
          </>
        )}
      </section>
      <HighlightedDescription
        html={job.descriptionHtml}
        data={data}
        analysis={analysis}
        highlight={highlight}
      />
    </div>
  );
}
