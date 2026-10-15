import './suggestion-diff.css';

export function ResumeSuggestionDiff({
  before,
  after,
  line,
  guidance,
}: {
  before: string | null;
  after: string | null;
  line?: number | null;
  guidance: string;
}) {
  const rewritten = !!after && after !== before;

  return (
    <div
      className="resume-suggestion-diff"
      aria-label="Resume suggestion comparison"
    >
      <div className="resume-diff-original">
        <div className="resume-diff-label">Current resume{line ? ` · Line ${line}` : ''}</div>
        <div className="resume-diff-body">
          <span aria-hidden="true">{before ? '−' : '·'}</span>
          <p>{before ?? 'No supporting resume excerpt.'}</p>
        </div>
      </div>
      <div className={`resume-diff-proposed${rewritten ? ' is-rewrite' : ''}`}>
        <div className="resume-diff-label">
          {rewritten ? 'Suggested wording' : 'Suggested next step'}
        </div>
        <div className="resume-diff-body">
          <span aria-hidden="true">{rewritten ? '+' : '→'}</span>
          <p>{rewritten ? after : guidance}</p>
        </div>
        {!rewritten && <small>Guidance · add details only when true</small>}
      </div>
    </div>
  );
}
