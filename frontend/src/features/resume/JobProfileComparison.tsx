import { useEffect, useState } from 'react';
import { compareJobResume } from '../../api/client.js';
import type { Job, JobMatchResponse, ResumeAnalysis } from '../../api/client.js';
import { matchProfile } from './match-profile.js';
import { ConfidenceLegend, MatchEvidence } from './MatchEvidence.js';
import { highlightSegments } from './highlights.js';

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
                  {data.availability} Checked {new Date(data.lastSeenAt).toLocaleString()}. Keywords
                  in company context are highlighted too; they do not automatically count as
                  requirements.
                </p>
                <label className="resume-checkbox">
                  <input
                    type="checkbox"
                    checked={highlight}
                    onChange={(event) => setHighlight(event.target.checked)}
                  />
                  Highlight recognized keywords
                </label>
                <details>
                  <summary>
                    Requirement evidence · {data.comparison.requiredGaps} required gap(s)
                  </summary>
                  <MatchEvidence comparison={data.comparison} />
                </details>
              </>
            )}
          </>
        )}
      </section>
      {data && highlight ? (
        <article
          className="description highlighted-description"
          aria-label="Job description with resume evidence"
        >
          {highlightSegments(data.descriptionText, data.skills).map((segment, index) =>
            segment.span ? (
              <mark
                key={index}
                className={`keyword-${segment.span.confidence}`}
                title={`${segment.span.name}: ${segment.span.reason}${segment.span.path.length ? ` ${segment.span.sourceName} → ${segment.span.path.map((edge) => edge.to).join(' → ')} (${Math.round(segment.span.credit * 100)}% evidence weight)` : ''}`}
              >
                {segment.text}
                <span className="sr-only">
                  {' '}
                  (
                  {segment.span.confidence === 'green'
                    ? 'direct match'
                    : segment.span.confidence === 'orange'
                      ? 'uncertain or related'
                      : 'no match'}
                  )
                </span>
              </mark>
            ) : (
              segment.text
            ),
          )}
        </article>
      ) : (
        <article
          className="description"
          dangerouslySetInnerHTML={{ __html: job.descriptionHtml }}
        />
      )}
    </div>
  );
}
