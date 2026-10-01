import type { JobMatchResponse } from '../../api/client.js';

type Comparison = JobMatchResponse['comparison'];

export function ConfidenceLegend() {
  return (
    <p className="confidence-legend">
      <span className="confidence-green">Green · direct match</span>
      <span className="confidence-orange">Orange · uncertain or related</span>
      <span className="confidence-red">Red · no evidence</span>
    </p>
  );
}

export function MatchEvidence({ comparison }: { comparison: Comparison }) {
  return (
    <>
      <ul className="match-evidence">
        {comparison.skills.map((skill, index) => (
          <li key={index}>
            <strong className={`confidence-${skill.confidence}`}>
              {skill.names.join(' or ')} ·{' '}
              {skill.confidence === 'green'
                ? 'Direct match'
                : skill.confidence === 'orange'
                  ? 'Uncertain'
                  : 'No match'}
            </strong>{' '}
            · {skill.importance}
            <p className="small-note">{skill.reason}</p>
            {skill.path.length > 0 && (
              <details className="relation-path">
                <summary>
                  {skill.sourceName} → {skill.names.join(' or ')} · {Math.round(skill.credit * 100)}
                  % evidence weight
                </summary>
                <p className="small-note">
                  Heuristic weight, not a probability or confirmed proficiency.
                </p>
                <ol>
                  {skill.path.map((edge, edgeIndex) => (
                    <li key={edgeIndex}>
                      {edge.from} → {edge.to} ({Math.round(edge.weight * 100)}%) · {edge.reason}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <p className="small-note">{skill.excerpt}</p>
          </li>
        ))}
      </ul>
      {comparison.experience.map((entry, index) => (
        <p key={index}>
          <strong
            className={`confidence-${entry.status === 'met' ? 'green' : entry.status === 'below' ? 'red' : 'orange'}`}
          >
            {entry.minimumMonths / 12}+ years{' '}
            {entry.scope === 'skill' ? 'in this specific skill or leadership role' : entry.scope} ·{' '}
            {entry.status}
          </strong>{' '}
          · {entry.importance}
          <br />
          Reviewed:{' '}
          {entry.scope === 'skill'
            ? 'duration not established'
            : `${(entry.candidateMinimumMonths / 12).toFixed(1)}–${(entry.candidateMaximumMonths / 12).toFixed(1)} years`}
          <br />
          <span className="small-note">{entry.excerpt}</span>
        </p>
      ))}
      {comparison.uncertainties.length > 0 && (
        <details>
          <summary>Other requirements to review ({comparison.uncertainties.length})</summary>
          <ul>
            {comparison.uncertainties.map((value, index) => (
              <li key={index}>{value}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
