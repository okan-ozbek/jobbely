import type { JobMatchResponse } from '../../api/client.js';

export function MatchMetrics({ comparison }: { comparison: JobMatchResponse['comparison'] }) {
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
      <details className="match-metrics-help small-note">
        <summary>About these scores</summary>
        <p>
          Green qualifications contribute 100%, yellow or unassessable qualifications 25%, and red
          gaps 0%. Purple skill suggestions contribute 0% until confirmed. Required qualifications
          carry three times the weight of preferred qualifications. Repeated criteria count once,
          and alternatives count as one criterion. Role relevance helps rank results without adding
          points to qualification fit.
        </p>
        <p>
          The parser can miss requirements. These numbers are not confidence or hiring
          probabilities. Assessment coverage counts completed comparisons, including gaps;
          unassessable qualifications remain visible and are not treated as satisfied.
        </p>
      </details>
    </div>
  );
}
