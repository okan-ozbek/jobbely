import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';
import type { Account } from '../../api/accounts.js';
import { assessResumeRole, reviewAvailability } from '../../api/resume-review.js';
import type { RoleAssessment, ReviewAvailability } from '../../api/resume-review.js';
import { ProReviewPanel } from './ProReviewPanel.js';
import { ResumeSuggestionDiff } from './ResumeSuggestionDiff.js';
import { ReviewProgress } from './ReviewProgress.js';
import './role-assessment.css';

const labels = {
  strong: 'Strong overlap',
  partial: 'Partial overlap',
  limited: 'Limited evidence',
  unknown: 'Unavailable',
};

const screeningLabels = {
  potential_fit: 'Requirements appear supported',
  needs_clarification: 'Evidence needs clarification',
  requirements_not_demonstrated: 'Required qualifications not demonstrated',
  insufficient_context: 'Screening readiness unverified',
};

export function RoleAlignmentAssessment({
  jobId,
  text,
  account,
}: {
  jobId: string;
  text: string;
  account: Account | null | undefined;
}) {
  const [availability, setAvailability] = useState<ReviewAvailability | null>(null);

  const [receipt, setReceipt] = useState<{
    jobId: string;
    text: string;
    data: RoleAssessment;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  const identity = account?.user?.id;
  const csrf = account?.csrfToken ?? '';
  const expiry = account?.access.accessEndsAt;

  const result =
    availability?.enabled &&
    receipt?.jobId === jobId &&
    receipt.text === text &&
    receipt.data.ats.screening &&
    receipt.data.recruiter.screening
      ? receipt.data
      : null;

  useEffect(() => {
    let controller = new AbortController();

    const refresh = () => {
      controller.abort();
      controller = new AbortController();

      const signal = controller.signal;

      void reviewAvailability(signal)
        .then((value) => {
          if (!signal.aborted) {
            setAvailability(value);

            if (!value.enabled) {
              active.current?.abort();
              setReceipt(null);
              setLoading(false);
            }
          }
        })
        .catch(() => {
          if (!signal.aborted) {
            setAvailability(null);
            active.current?.abort();
            setReceipt(null);
            setLoading(false);
            setError('Could not verify AI assessment access.');
          }
        });
    };

    setAvailability(null);
    refresh();
    window.addEventListener('focus', refresh);

    const end = Date.parse(expiry ?? '');

    const timer =
      Number.isFinite(end) && end > Date.now()
        ? window.setTimeout(refresh, Math.min(end - Date.now() + 50, 2_147_483_647))
        : undefined;

    return () => {
      controller.abort();
      window.removeEventListener('focus', refresh);
      window.clearTimeout(timer);
    };
  }, [identity, csrf, expiry]);

  useEffect(() => {
    active.current?.abort();
    setReceipt(null);
    setLoading(false);
    setError('');

    return () => active.current?.abort();
  }, [jobId, text, identity, csrf]);

  async function assess() {
    if (loading || !availability?.enabled || !availability.aiAvailable || !csrf || !text.trim()) {
      return;
    }

    const controller = new AbortController();

    active.current = controller;
    setLoading(true);
    setError('');
    setReceipt(null);

    try {
      const data = await assessResumeRole(jobId, text, csrf, controller.signal);

      if (!controller.signal.aborted) {
        setReceipt({ jobId, text, data });
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : 'Could not assess alignment.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  return (
    <ProReviewPanel
      className="role-ai-assessment"
      id="role-ai-heading"
      title="Pro resume reviewer"
      module="role"
      infoTitle="Assessment limits"
      limitations={
        result?.limitations ?? [
          'Rehearses stated job requirements against original resume evidence, with separate keyword and recruiter assessments.',
          'Missing or contradicted required qualifications are screening gaps. Wording cannot replace experience or credentials.',
          'Evidence confidence is qualitative, not a probability of passing. Employer ATS rules and recruiter decisions are unavailable.',
          'Only fact-preserving wording is shown as an edit. Verify every suggestion before using it.',
        ]
      }
      actions={
        <>
          <button
            type="button"
            className="primary-button"
            disabled={
              loading ||
              !availability?.enabled ||
              !availability.aiAvailable ||
              !text.trim() ||
              text.length > 40_000
            }
            aria-busy={loading}
            onClick={() => void assess()}
          >
            {loading ? (
              <LoaderCircle
                size={16}
                className="review-action-spinner"
                aria-hidden="true"
              />
            ) : (
              <Sparkles
                size={16}
                aria-hidden="true"
              />
            )}{' '}
            {loading ? 'Assessing…' : 'Assess with AI'}
          </button>
          {loading && (
            <button
              type="button"
              className="resume-secondary-button"
              onClick={() => {
                active.current?.abort();
                setLoading(false);
              }}
            >
              Cancel
            </button>
          )}
        </>
      }
    >
      <p className="role-ai-intro">Screen your resume against this role’s requirements.</p>
      <p className="small-note">
        Uses your resume text and this job description. Processed by OpenAI. Alignment and evidence
        confidence are qualitative, not screening pass probabilities.
      </p>
      {availability && !availability.enabled && (
        <p className="small-note">Sign in with active Pro access to use AI assessment.</p>
      )}
      {availability?.enabled && !availability.aiAvailable && (
        <p className="small-note">AI assessment is not configured.</p>
      )}
      {text.length > 40_000 && (
        <p role="alert">Use a resume of up to 40,000 characters for AI assessment.</p>
      )}
      {loading && (
        <ReviewProgress
          title="Comparing your resume with this role…"
          description="Reviewing requirements, experience and supporting evidence. This can take a moment."
        />
      )}
      {error && (
        <p
          className="error-state"
          role="alert"
        >
          {error}
        </p>
      )}
      {result &&
        (result.aiStatus !== 'completed' ? (
          <p role="status">
            AI assessment could not be verified. Your qualification comparison is still available.
          </p>
        ) : (
          <div aria-live="polite">
            <div className="role-ai-summary">
              {(['ats', 'recruiter'] as const).map((area) => (
                <div key={area}>
                  <span>
                    {area === 'ats' ? 'ATS keyword alignment' : 'Recruiter evidence alignment'}
                  </span>
                  <strong>{screeningLabels[result[area].screening]}</strong>
                  <span>
                    {labels[result[area].alignment]}
                    {result[area].requiredGaps
                      ? ` · ${result[area].requiredGaps} required gap${result[area].requiredGaps === 1 ? '' : 's'}`
                      : ''}
                  </span>
                  <small>
                    Evidence confidence: {result[area].confidence} · {result[area].evidenceCount}{' '}
                    observations
                  </small>
                </div>
              ))}
            </div>
            {(result.ats.requiredGaps > 0 || result.recruiter.requiredGaps > 0) && (
              <p
                className="role-screening-gap"
                role="status"
              >
                Required evidence is missing or conflicts with the role. Resume wording cannot
                resolve a substantive experience or qualification gap. Verify these requirements
                before applying; consider roles closer to your demonstrated experience.
              </p>
            )}
            {result.coverage === 'partial' && (
              <p className="small-note">
                Some requirements could not be fully reviewed. Screening readiness remains
                unverified.
              </p>
            )}
            {(['ats', 'recruiter'] as const).map((area) => (
              <div key={area}>
                <h4>
                  {area === 'ats' ? 'Keywords and requirements' : 'Experience and contribution'}
                </h4>
                <ul className="role-ai-evidence">
                  {result.evidence
                    .filter((row) => row.area === area)
                    .map((row, index) => (
                      <li key={index}>
                        <span className={`role-evidence-status role-evidence-${row.status}`}>
                          {row.status === 'supported'
                            ? 'Overlap'
                            : row.status === 'partial'
                              ? 'Partial overlap'
                              : row.status === 'contradicted'
                                ? 'Requirement conflict'
                                : 'Missing evidence'}
                        </span>
                        <span className="role-evidence-priority">
                          {row.priority === 'required'
                            ? 'Required'
                            : row.priority === 'preferred'
                              ? 'Preferred'
                              : 'Responsibility'}
                        </span>
                        <small>Job requirement</small>
                        <blockquote>{row.jobQuote}</blockquote>
                        <ResumeSuggestionDiff
                          before={row.resumeQuote}
                          after={row.rewrite}
                          line={row.line}
                          guidance={row.suggestion}
                        />
                        <p>
                          <strong>Why this matters: </strong>
                          {row.explanation}
                        </p>
                        {row.rewrite && (
                          <p>
                            <strong>Try this: </strong>
                            {row.suggestion}
                          </p>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
    </ProReviewPanel>
  );
}
