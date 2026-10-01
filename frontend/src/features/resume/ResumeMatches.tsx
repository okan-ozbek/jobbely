import { useEffect, useRef, useState } from 'react';
import { matchResume } from '../../api/client.js';
import { CompanyLogo } from '../../components/CompanyLogo.js';
import { matchProfile } from './match-profile.js';
import { ConfidenceLegend, MatchEvidence } from './MatchEvidence.js';
import type { MatchInput, MatchResponse, ResumeAnalysis } from '../../api/client.js';

const functions = [
  { id: 'engineering', name: 'Engineering' },
  { id: 'data-ai', name: 'Data & AI' },
  { id: 'product', name: 'Product' },
  { id: 'sales', name: 'Sales' },
  { id: 'people', name: 'People' },
] as const;

export function ResumeMatches({
  analysis,
  pending,
  openJob,
  onReviewed,
}: {
  analysis: ResumeAnalysis;
  pending: boolean;
  openJob: (id: string) => void;
  onReviewed: (analysis: ResumeAnalysis | null) => void;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [category, setCategory] = useState('engineering');
  const [employerContext, setEmployerContext] = useState(false);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    request.current?.abort();
    setReviewed(false);
    onReviewed(null);
    setResult(null);
    setLoading(false);
    setError('');

    return () => request.current?.abort();
  }, [analysis, pending, category, employerContext, onReviewed]);

  const find = async (more = false) => {
    request.current?.abort();

    const controller = new AbortController();

    request.current = controller;
    setLoading(true);
    setError('');

    const body: MatchInput = {
      profile: matchProfile(analysis),
      categories: functions
        .filter((item) => !category || item.id === category)
        .map((item) => item.id),
      employerContext,
      limit: 20,
      ...(more && result?.nextCursor ? { cursor: result.nextCursor } : {}),
    };

    try {
      const next = await matchResume(body, controller.signal);

      if (!controller.signal.aborted) {
        setResult(more && result ? { ...next, items: [...result.items, ...next.items] } : next);
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setResult(null);
        setError(reason instanceof Error ? reason.message : 'Could not match this profile.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  return (
    <section
      className="resume-panel resume-matches"
      aria-labelledby="matches-heading"
    >
      <div className="section-heading">
        <h2 id="matches-heading">Find your next role</h2>
        <span className="resume-status">Explained recommendations</span>
      </div>
      <p className="small-note">
        Review your skills, roles and location first. Scores summarize the available evidence; they
        do not predict hiring decisions. Unknown authorization, qualifications and skill-specific
        tenure remain visible.
      </p>
      <div className="match-controls">
        <label>
          Function
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All supported functions</option>
            {functions.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="resume-checkbox">
          <input
            type="checkbox"
            checked={employerContext}
            onChange={(event) => setEmployerContext(event.target.checked)}
          />
          Optional employer context
        </label>
      </div>
      <p className="small-note">
        Employer context can add 3 points for reviewed direct experience in the same employer and
        function. It cannot change a fit band or override gaps. Unknown employers have no penalty.
      </p>
      <label className="resume-checkbox">
        <input
          type="checkbox"
          checked={reviewed}
          disabled={pending}
          onChange={(event) => {
            setReviewed(event.target.checked);
            onReviewed(event.target.checked ? analysis : null);
          }}
        />
        I reviewed this profile and its claims.
      </label>
      <button
        className="primary-button"
        type="button"
        disabled={!reviewed || pending || loading}
        onClick={() => {
          void find();
        }}
      >
        {loading ? 'Comparing requirements…' : 'Find matching jobs'}
      </button>
      {error && (
        <p
          role="alert"
          className="error-state"
        >
          {error}
        </p>
      )}
      {result && (
        <>
          <p
            role="status"
            className="small-note"
          >
            {result.evaluated.toLocaleString()} jobs evaluated ·{' '}
            {result.unenriched.toLocaleString()} awaiting requirement analysis · fresh within{' '}
            {result.freshnessHours} hours. {result.excludedSources} sources excluded by availability
            checks.
          </p>
          {result.items.length === 0 && (
            <div className="empty-state">
              <h3>No eligible jobs right now.</h3>
              <p>
                {result.mode === 'demo'
                  ? 'Synthetic demo listings are excluded from recommendations.'
                  : 'Choose another function or check company source coverage. Stale, closed and failed-source listings are excluded.'}
              </p>
            </div>
          )}
          <div className="match-list">
            {result.items.map((item) => (
              <article
                className="match-card"
                key={item.job.id}
              >
                <div className="section-heading">
                  <div className="match-company">
                    <CompanyLogo
                      name={item.companyName}
                      logoUrl={item.logoUrl ?? undefined}
                    />
                    <div>
                      <span className="company-label">{item.companyName}</span>
                      <h3>{item.job.title}</h3>
                    </div>
                  </div>
                  <span className="resume-status">
                    {item.band === 'review' ? 'Needs review' : item.band} · {item.baseScore}
                    {item.employerAdjustment.points > 0
                      ? ` + ${item.employerAdjustment.points}`
                      : ''}
                  </span>
                </div>
                <p className="small-note">
                  Evidence completeness {item.completeness}% · {item.requiredGaps} required gap(s) ·
                  checked {new Date(item.job.lastSeenAt).toLocaleString()}
                  <br />
                  {item.coverage}
                </p>
                <details>
                  <summary>Why this result</summary>
                  <ConfidenceLegend />
                  <MatchEvidence comparison={item} />
                  <p>{item.location}</p>
                  {item.employerAdjustment.reasons.map((value, index) => (
                    <p
                      className="small-note"
                      key={index}
                    >
                      {value}
                    </p>
                  ))}
                </details>
                <div className="resume-actions">
                  <button
                    type="button"
                    className="resume-secondary-button"
                    onClick={() => openJob(item.job.id)}
                  >
                    Description & requirements
                  </button>
                  <a
                    href={item.job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Original application ↗
                  </a>
                </div>
              </article>
            ))}
          </div>
          {result.nextCursor && (
            <button
              className="load-more"
              type="button"
              disabled={loading || pending}
              onClick={() => {
                void find(true);
              }}
            >
              Load more recommendations
            </button>
          )}
        </>
      )}
    </section>
  );
}
