import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ClipboardCheck, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react';
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
import { ProReviewPanel } from './ProReviewPanel.js';
import { ResumeSuggestionDiff } from './ResumeSuggestionDiff.js';
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
  const formId = useId();
  const [availability, setAvailability] = useState<ReviewAvailability | null>(null);
  const [accessError, setAccessError] = useState('');
  const [language, setLanguage] = useState<ResumeReviewInput['language']>('en-GB');
  const [targetCountry, setTargetCountry] = useState('');
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
      jobDescription: '',
      ...(layout ? { layout } : {}),
    }),
    [text, aiConsent, language, targetCountry, layout],
  );

  const result = availability?.enabled && receipt?.input === input ? receipt.result : null;

  useEffect(() => {
    setAiConsent(false);
  }, [availability?.aiProvider]);

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
    <ProReviewPanel
      id="writing-review-title"
      title="Pro resume reviewer"
      module="resume"
      className="resume-reviewer"
      actions={
        availability?.enabled && (
          <>
            <button
              type="submit"
              form={formId}
              className="primary-button"
              aria-busy={loading}
              disabled={!text.trim() || text.length > 40_000 || pending || loading || !csrf}
            >
              {loading ? (
                <LoaderCircle
                  className="reviewer-spinner"
                  size={16}
                  aria-hidden="true"
                />
              ) : (
                <Sparkles
                  size={16}
                  aria-hidden="true"
                />
              )}
              Review resume
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
          </>
        )
      }
      limitations={
        result?.limitations ?? [
          'Checks common document mistakes and offers optional AI feedback on spelling, grammar, clarity and contribution.',
          'Formatting checks use extracted layout hints; exact margins, colors, clipping and images are not assessed.',
          'Findings describe your document, not employability or an ATS pass score. Review AI suggestions before using them.',
        ]
      }
    >
      <p>
        Check common mistakes and formatting risks. Add optional AI feedback on clarity, grammar and
        contribution.
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
          id={formId}
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
          <label className="reviewer-consent">
            <input
              type="checkbox"
              checked={aiConsent}
              disabled={!availability.aiAvailable}
              onChange={(event) => setAiConsent(event.target.checked)}
            />
            <span>Include AI writing feedback</span>
          </label>
          {!availability.aiAvailable && (
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
        </form>
      )}
      {loading && (
        <div
          className="reviewer-progress"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div
            className="reviewer-progress-icon"
            aria-hidden="true"
          >
            {aiConsent ? <Sparkles size={28} /> : <ClipboardCheck size={28} />}
          </div>
          <div className="reviewer-progress-copy">
            <strong>
              {aiConsent ? 'Reviewing your resume with AI…' : 'Checking your resume…'}
            </strong>
            <p>
              {aiConsent
                ? 'Checking clarity, grammar and contribution. This can take a moment.'
                : 'Looking for common mistakes and formatting risks.'}
            </p>
            <div
              className="reviewer-progress-track"
              aria-hidden="true"
            >
              <span />
            </div>
          </div>
        </div>
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
          {result.findings.length === 0 && (
            <p role="status">No issues found by the available checks.</p>
          )}
          {(result.aiStatus === 'failed' || result.aiStatus === 'unavailable') && (
            <p role="status">
              AI feedback could not be completed. Document checks are shown below.
            </p>
          )}
          {(['error', 'risk', 'suggestion'] as const).map((severity) => {
            const findings = result.findings.filter((finding) => finding.severity === severity);

            return findings.length ? (
              <div key={severity}>
                <h3>
                  {severity === 'error'
                    ? 'Errors to fix'
                    : severity === 'risk'
                      ? 'Risks to review'
                      : 'Suggestions to consider'}{' '}
                  ({findings.length})
                </h3>
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
                      <ResumeSuggestionDiff
                        before={finding.quote}
                        after={finding.rewrite}
                        line={finding.line}
                        guidance={finding.suggestion}
                      />
                      <p>{finding.explanation}</p>
                      {finding.rewrite && (
                        <p>
                          <strong>Try this: </strong>
                          {finding.suggestion}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null;
          })}
        </div>
      )}
    </ProReviewPanel>
  );
}
