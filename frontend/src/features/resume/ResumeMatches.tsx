import { useEffect, useRef, useState } from 'react';
import { matchResume } from '../../api/client.js';
import { CompanyLogo } from '../../components/CompanyLogo.js';
import { matchProfile } from './match-profile.js';
import { ConfidenceLegend, MatchEvidence } from './MatchEvidence.js';
import type { MatchInput, MatchResponse, ResumeAnalysis } from '../../api/client.js';

import { inferMatchingFunction, matchingFunctions as functions } from './matching-function.js';
import { Disclosure } from '../../components/Disclosure.js';
import { scrollToSection } from '../../components/motion.js';

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
  const [category, setCategory] = useState('auto');
  const inferred = inferMatchingFunction(analysis);
  const selectedCategory = category === 'auto' ? (inferred?.id ?? '') : category;
  const resultsAnchor = useRef<HTMLParagraphElement>(null);
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
  }, [analysis, pending, category, onReviewed]);

  const find = async (more = false) => {
    request.current?.abort();

    const controller = new AbortController();

    request.current = controller;
    setLoading(true);
    setError('');

    const body: MatchInput = {
      profile: matchProfile(analysis),
      categories: functions
        .filter((item) => !selectedCategory || item.id === selectedCategory)
        .map((item) => item.id),
      employerContext: false,
      limit: 20,
      ...(more && result?.nextCursor ? { cursor: result.nextCursor } : {}),
    };

    try {
      const next = await matchResume(body, controller.signal);

      if (!controller.signal.aborted) {
        setResult(more && result ? { ...next, items: [...result.items, ...next.items] } : next);

        if (!more) {
          requestAnimationFrame(() => {
            if (!controller.signal.aborted) {
              scrollToSection(resultsAnchor.current);
            }
          });
        }
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
        <h2 id="matches-heading">Your job matches</h2>
        <span className="resume-status">Based on your profile</span>
      </div>
      <p className="small-note">
        Check your profile above, then find roles that fit. Match scores describe the evidence in
        your resume; they don’t predict hiring decisions.
      </p>
      <div className="match-controls">
        <label>
          Function
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="auto">
              {inferred
                ? `From resume � ${inferred.name}`
                : 'From resume � all supported functions'}
            </option>
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
      </div>
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
        I’ve reviewed my skills, experience and location.
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
            ref={resultsAnchor}
            role="status"
            className="small-note matches-anchor"
          >
            {result.evaluated.toLocaleString()} jobs evaluated ·{' '}
            {result.unenriched.toLocaleString()} awaiting requirement analysis · fresh within{' '}
            {result.freshnessHours} hours. {result.excludedSources} sources excluded by availability
            checks.
          </p>
          {result.items.length === 0 && (
            <div className="empty-state">
              <h3>
                {result.unenriched > 0
                  ? 'Job analysis is catching up.'
                  : 'No freshly checked jobs right now.'}
              </h3>
              <p>
                {result.mode === 'demo'
                  ? 'Synthetic demo listings are excluded from recommendations.'
                  : result.unenriched > 0
                    ? 'Listings are available, but their requirements still need analysis. Try again after the job index is refreshed.'
                    : 'This isn’t a judgment of your resume. There are no available listings passing the current freshness checks for this function. Check Companies for source status or try another function.'}
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
                  Evidence completeness {item.completeness}% · {item.requiredGaps} recognized
                  required gap(s) · {item.unresolvedRequirements} unresolved requirement(s) ·
                  checked {new Date(item.job.lastSeenAt).toLocaleString()}
                  <br />
                  {item.coverage}
                </p>
                <Disclosure summary="Why this result">
                  <ConfidenceLegend />
                  <MatchEvidence
                    comparison={item}
                    analysis={analysis}
                  />
                  <p>{item.location}</p>
                  {item.employerAdjustment.reasons.map((value, index) => (
                    <p
                      className="small-note"
                      key={index}
                    >
                      {value}
                    </p>
                  ))}
                </Disclosure>
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
