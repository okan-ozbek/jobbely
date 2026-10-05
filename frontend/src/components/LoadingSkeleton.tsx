import './skeleton.css';

type SkeletonKind = 'jobs' | 'companies' | 'detail' | 'profile' | 'matches' | 'text';

function Lines() {
  return (
    <div className="skeleton-lines">
      <span className="skeleton-shape skeleton-line short" />
      <span className="skeleton-shape skeleton-line title" />
      <span className="skeleton-shape skeleton-line" />
    </div>
  );
}

export function LoadingSkeleton({
  kind,
  label,
  count = 3,
}: {
  kind: SkeletonKind;
  label: string;
  count?: number;
}) {
  return (
    <div
      className={`loading-skeleton skeleton-${kind}`}
      role="status"
      aria-busy="true"
    >
      <span className="visually-hidden">{label}</span>
      <div
        className="skeleton-content"
        aria-hidden="true"
      >
        {kind === 'detail' ? (
          <>
            <div className="skeleton-detail-heading">
              <span className="skeleton-shape skeleton-logo" />
              <Lines />
            </div>
            <div className="skeleton-detail-grid">
              <div className="skeleton-card">
                <Lines />
                <Lines />
                <Lines />
              </div>
              <div className="skeleton-card">
                <Lines />
                <Lines />
              </div>
            </div>
          </>
        ) : (
          Array.from({ length: count }, (_, index) => (
            <div
              className="skeleton-card"
              key={index}
            >
              {kind !== 'text' && kind !== 'profile' && (
                <span className="skeleton-shape skeleton-logo" />
              )}
              <Lines />
              {kind === 'matches' && <Lines />}
              {(kind === 'companies' || kind === 'matches') && (
                <span className="skeleton-shape skeleton-line short" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
