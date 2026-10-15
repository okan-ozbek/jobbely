import type { JobMatchResponse } from '../../api/client.js';
import type { ReactNode } from 'react';

export function MatchMetrics({
  comparison,
  children,
}: {
  comparison: JobMatchResponse['comparison'];
  children?: ReactNode;
}) {
  const coverage = comparison.assessmentCoverage;

  return (
    <div className="match-assessment">
      <dl className="match-metrics">
        <div>
          <dt>Qualification fit</dt>
          <dd>
            {comparison.fitScore !== null
              ? `${new Intl.NumberFormat('en', { maximumFractionDigits: 1, roundingMode: 'floor' }).format(comparison.fitScore)}%`
              : coverage.limited
                ? 'Analysis incomplete'
                : 'Not enough information'}
          </dd>
        </div>
        <div>
          <dt>Assessment coverage</dt>
          <dd>{coverage.percentage === null ? 'Unavailable' : `${coverage.percentage}%`}</dd>
          <span className="small-note">
            {coverage.limited
              ? 'Description analysis is incomplete'
              : coverage.total === 0
                ? 'No assessable criteria identified'
                : `${coverage.assessed} of ${coverage.total} identified criteria assessed · ${comparison.unresolvedRequirements} unassessable`}
          </span>
        </div>
      </dl>
      {children}
    </div>
  );
}
