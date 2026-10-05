import { coverageLabel, orderedSkillEvidence } from './semantic-review.js';
import type { JobMatchResponse, ResumeAnalysis } from '../../api/client.js';

type Comparison = JobMatchResponse['comparison'];

export function ConfidenceLegend() {
  return (
    <p className="confidence-legend">
      <span className="confidence-green">Green · full match</span>
      <span className="confidence-yellow">Yellow · partial or uncertain</span>
      <span className="confidence-purple">Purple · possible unmentioned skill</span>
      <span className="confidence-red">Red · no evidence</span>
    </p>
  );
}

export function MatchEvidence({
  comparison,
  analysis,
}: {
  comparison: Comparison;
  analysis?: ResumeAnalysis;
}) {
  return (
    <>
      {comparison.skills.some((skill) => skill.importance === 'contextual') && (
        <p className="small-note">
          Skills used in this role add {comparison.roleRelevancePoints}/5 points. Missing role
          skills do not create required gaps.
        </p>
      )}
      <ul className="match-evidence">
        {orderedSkillEvidence(comparison.skills).map((skill, index) => (
          <li key={index}>
            <strong className={`confidence-${skill.confidence}`}>
              {skill.names.join(' or ')} · {coverageLabel(skill.decision)}
            </strong>{' '}
            · {skill.importance === 'contextual' ? 'role relevance' : skill.importance}
            <p className="small-note">{skill.reason}</p>
            {skill.path.length > 0 && skill.decision !== 'suggested' && (
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
            {skill.evidenceRefs.map((ref, evidenceIndex) => {
              const block = analysis?.document.blocks.find((item) => item.id === ref.blockId);
              const role = analysis?.employment.find((item) => item.id === ref.roleId);

              return (
                <details key={evidenceIndex}>
                  <summary>
                    Resume evidence · {ref.source} · {ref.assertion} · {ref.action}
                    {role ? ` · ${role.title} at ${role.employer}` : ''}
                  </summary>
                  <p className="small-note">
                    Source lines: {ref.lineIds.join(', ')}. Outcome: {ref.outcome}.
                  </p>
                  {block && <p>{block.text}</p>}
                </details>
              );
            })}
            {skill.unresolvedAlternatives.length > 0 && (
              <p className="small-note">
                Unknown alternatives to review: {skill.unresolvedAlternatives.join(' / ')}
              </p>
            )}
            <p className="small-note">{skill.excerpt}</p>
          </li>
        ))}
      </ul>
      {comparison.experience.map((entry, index) => (
        <p key={index}>
          <strong
            className={`confidence-${entry.status === 'met' ? 'green' : entry.status === 'below' ? 'red' : 'yellow'}`}
          >
            {entry.minimumMonths / 12}
            {entry.maximumMonths ? `–${entry.maximumMonths / 12}` : '+'} years{' '}
            {entry.scope === 'skill' ? 'in this specific skill or leadership role' : entry.scope} ·{' '}
            {entry.status}
          </strong>{' '}
          · {entry.importance}
          <br />
          Reviewed:{' '}
          {entry.scope === 'skill' && entry.status === 'uncertain'
            ? 'duration not established'
            : `${(entry.candidateMinimumMonths / 12).toFixed(1)}–${(entry.candidateMaximumMonths / 12).toFixed(1)} years`}
          <br />
          <span className="small-note">{entry.excerpt}</span>
        </p>
      ))}
      {comparison.education.map((entry, index) => (
        <p key={`degree-${index}`}>
          <strong
            className={`confidence-${entry.status === 'met' ? 'green' : entry.status === 'below' ? 'red' : 'yellow'}`}
          >
            {entry.name} · {entry.status}
          </strong>{' '}
          · {entry.importance}
          <br />
          <span className="small-note">{entry.reason}</span>
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
