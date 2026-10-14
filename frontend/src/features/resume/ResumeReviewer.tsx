import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCheck, LockKeyhole } from 'lucide-react';
import type { Account } from '../../api/accounts.js';
import { reviewAvailability, reviewResume } from '../../api/resume-review.js';
import type {
  ResumeReview,
  ResumeReviewInput,
  ReviewAvailability,
} from '../../api/resume-review.js';
import type { ExtractedDocument } from './documents/model.js';
import { reviewLayout } from './review-layout.js';
import { GlassSelect } from '../../components/GlassSelect.js';
import { Disclosure } from '../../components/Disclosure.js';
import './reviewer.css';

export function ResumeReviewer({
  text,
  document,
  account,
  pending,
  openPricing,
}: {
  text: string;
  document: ExtractedDocument | null;
  account: Account | null | undefined;
  pending: boolean;
  openPricing: () => void;
}) {
  const [availability, setAvailability] = useState<ReviewAvailability | null>(null);
  const [accessError, setAccessError] = useState('');
  const [language, setLanguage] = useState<ResumeReviewInput['language']>('en-GB');
  const [targetCountry, setTargetCountry] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [receipt, setReceipt] = useState<{ input: ResumeReviewInput; result: ResumeReview } | null>(
    null,
  );

  const active = useRef<AbortController | null>(null);
  const csrf = account?.csrfToken ?? '';
  const identity = account?.user?.id ?? '';
  const capabilities = account?.access.capabilities.join(',') ?? '';
  const layout = useMemo(() => reviewLayout(document), [document]);

  const input = useMemo<ResumeReviewInput>(
    () => ({
      text,
      aiConsent,
      language,
      targetCountry,
      jobDescription,
      ...(layout ? { layout } : {}),
    }),
    [text, aiConsent, language, targetCountry, jobDescription, layout],
  );

  const result = availability?.enabled && receipt?.input === input ? receipt.result : null;

  useEffect(() => {
    let controller = new AbortController();

    const refresh = () => {
      controller.abort();
      controller = new AbortController();

      const signal = controller.signal;

      void reviewAvailability(signal)
        .then((value) => {
          if (!signal.aborted) {
            setAccessError('');
            setAvailability(value);

            if (!value.enabled) {
              active.current?.abort();
              setLoading(false);
              setReceipt(null);
            }
          }
        })
        .catch(() => {
          if (!signal.aborted) {
            active.current?.abort();
            setLoading(false);
            setAvailability(null);
            setReceipt(null);
            setAccessError('Could not verify reviewer access. Refresh your account and try again.');
          }
        });
    };

    setAvailability(null);
    setAccessError('');

    refresh();
    window.addEventListener('focus', refresh);

    const expiry = Date.parse(account?.access.accessEndsAt ?? '');

    const timer =
      Number.isFinite(expiry) && expiry > Date.now()
        ? window.setTimeout(refresh, Math.min(expiry - Date.now() + 50, 2_147_483_647))
        : undefined;

    return () => {
      controller.abort();
      window.removeEventListener('focus', refresh);
      window.clearTimeout(timer);
    };
  }, [identity, csrf, capabilities, account?.access.accessEndsAt]);

  useEffect(() => {
    active.current?.abort();
    setLoading(false);
    setReceipt(null);
    setError('');

    return () => active.current?.abort();
  }, [input, identity, csrf]);

  const submit = async () => {
    if (loading || pending || !availability?.enabled || !csrf) {
      return;
    }

    active.current?.abort();

    const controller = new AbortController();

    active.current = controller;
    setLoading(true);
    setReceipt(null);
    setError('');

    try {
      const response = await reviewResume(input, csrf, controller.signal);

      if (!controller.signal.aborted) {
        setReceipt({ input, result: response });
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : 'Could not review your resume.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  return (
    <section
      className="resume-reviewer"
      aria-labelledby="writing-review-title"
    >
      <div className="reviewer-heading">
        <div>
          <span className="eyebrow">
            <ClipboardCheck size={15} /> Pro resume reviewer
          </span>
          <h2 id="writing-review-title">Make your resume easier to read.</h2>
        </div>
        <span className="resume-status">Pro</span>
      </div>
      <p>
        Check common mistakes and formatting risks. Add optional AI feedback on clarity,
        contribution and relevance.
      </p>
      {accessError ? (
        <p
          className="error-state"
          role="alert"
        >
          {accessError}
        </p>
      ) : !availability ? (
        <p role="status">Checking reviewer access…</p>
      ) : !availability.enabled ? (
        <div className="reviewer-locked">
          <LockKeyhole size={18} />
          <div>
            <strong>Available with active Pro access</strong>
            <p>
              {availability.signedIn
                ? 'Your account does not have reviewer access yet.'
                : 'Sign in with an active Pro account to review your resume.'}{' '}
              Test checkout does not grant paid access.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={openPricing}
            >
              View Pro plan
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="reviewer-settings">
            <label>
              <span>Resume language</span>
              <GlassSelect
                aria-label="Resume language"
                value={language}
                onValueChange={(value) => setLanguage(value as ResumeReviewInput['language'])}
              >
                <option value="en-GB">English (UK)</option>
                <option value="en-US">English (US)</option>
                <option value="nl-NL">Dutch</option>
              </GlassSelect>
            </label>
            <label>
              <span>Target country (optional)</span>
              <input
                value={targetCountry}
                maxLength={80}
                placeholder="e.g. Netherlands"
                onChange={(event) => setTargetCountry(event.target.value)}
              />
            </label>
          </div>
          <Disclosure summary="Compare writing with a job description (optional)">
            <label className="reviewer-job">
              <span>Public job description</span>
              <textarea
                value={jobDescription}
                maxLength={12_000}
                rows={5}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Paste the job description to focus AI suggestions on relevant experience."
              />
            </label>
          </Disclosure>
          <label className="reviewer-consent">
            <input
              type="checkbox"
              checked={aiConsent}
              disabled={!availability.aiAvailable}
              onChange={(event) => setAiConsent(event.target.checked)}
            />
            <span>Include AI writing feedback</span>
          </label>
          {availability.aiAvailable ? (
            <p className="small-note">
              Opting in sends selected resume text and the optional job description to OpenAI.
              Obvious contact lines and the first resume line are omitted; this does not fully
              anonymize your resume. API content is not used for training by default, but provider
              logs may retain it for up to 30 days, subject to exceptions. AI suggestions need your
              review.
            </p>
          ) : (
            <p className="small-note">
              AI feedback is not configured. Document checks are available.
            </p>
          )}
          {!document && (
            <p className="small-note">
              Pasted text supports writing and structure checks. Attach a PDF or DOCX for available
              layout checks.
            </p>
          )}
          {text.length > 40_000 && (
            <p className="error-state">
              The reviewer supports up to 40,000 characters. Use a shorter resume.
            </p>
          )}
          <div className="reviewer-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={!text.trim() || text.length > 40_000 || pending || loading || !csrf}
            >
              {loading ? 'Reviewing…' : aiConsent ? 'Review with AI' : 'Check my resume'}
            </button>
            {loading && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  active.current?.abort();
                  setLoading(false);
                }}
              >
                Cancel
              </button>
            )}
          </div>
          <p className="small-note">
            This review checks the current resume document. Profile corrections do not rewrite it.
            Jobbely does not save the review. AI feedback is limited to five requests per hour.
          </p>
        </form>
      )}
      {loading && (
        <p
          role="status"
          aria-live="polite"
        >
          Checking your resume…
        </p>
      )}
      {error && (
        <p
          className="error-state"
          role="alert"
        >
          {error}
        </p>
      )}
      {result && (
        <div
          className="reviewer-results"
          aria-live="polite"
        >
          <h3>
            {result.findings.length
              ? `${result.findings.length} points to review`
              : 'No issues found by the available checks'}
          </h3>
          {(result.aiStatus === 'failed' || result.aiStatus === 'unavailable') && (
            <p role="status">
              AI feedback could not be completed. Document checks are shown below.
            </p>
          )}
          {(['error', 'risk', 'suggestion'] as const).map((severity) => {
            const findings = result.findings.filter((finding) => finding.severity === severity);

            return findings.length ? (
              <div key={severity}>
                <h4>
                  {severity === 'error'
                    ? 'Errors to fix'
                    : severity === 'risk'
                      ? 'Risks to review'
                      : 'Suggestions to consider'}
                </h4>
                <ul className="reviewer-findings">
                  {findings.map((finding) => (
                    <li key={finding.id}>
                      <div className="reviewer-finding-heading">
                        <strong>{finding.title}</strong>
                        <span>
                          {finding.source === 'ai' ? 'AI suggestion' : 'Document check'}
                          {finding.page
                            ? ` · Page ${finding.page}`
                            : finding.line
                              ? ` · Line ${finding.line}`
                              : ''}
                        </span>
                      </div>
                      {finding.quote && <blockquote>{finding.quote}</blockquote>}
                      <p>{finding.explanation}</p>
                      <p>
                        <strong>Try this: </strong>
                        {finding.suggestion}
                      </p>
                      {finding.rewrite && (
                        <p className="reviewer-rewrite">
                          <strong>Suggested wording: </strong>
                          {finding.rewrite}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null;
          })}
          <Disclosure summary="What this review can assess">
            <ul>
              {result.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </Disclosure>
        </div>
      )}
    </section>
  );
}
