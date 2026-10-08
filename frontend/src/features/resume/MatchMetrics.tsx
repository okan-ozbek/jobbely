import type { JobMatchResponse } from '../../api/client.js';

export function MatchMetrics({ comparison }: { comparison: JobMatchResponse['comparison'] }) {
  const coverage = comparison.assessmentCoverage;

  return (
    <div className="match-assessment">
      <dl className="match-metrics">
        <div>
          <dt>Fit on assessed criteria</dt>
          <dd>
            {comparison.fitScore !== null
              ? `${new Intl.NumberFormat('en', { maximumFractionDigits: 1, roundingMode: 'floor' }).format(comparison.fitScore)}%`
              : coverage.total > 0
                ? 'Needs review'
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
                : `${coverage.assessed} of ${coverage.total} identified criteria assessed`}
          </span>
        </div>
      </dl>
      <details className="match-metrics-help small-note">
        <summary>About these scores</summary>
        <p>
          Fit is shown when all identified criteria have been assessed. Relevant role skills help
          rank results without adding points to this percentage. Coverage counts identified required
          and preferred criteria, including gaps; unresolved criteria lower coverage. Repeated
          criteria count once, and alternatives count as one criterion. Function and location
          overlap do not increase coverage.
        </p>
        <p>
          The parser can miss requirements. These numbers are not confidence or hiring
          probabilities. Within each review band, ranking weighs fit by assessment coverage.
        </p>
      </details>
    </div>
  );
}
