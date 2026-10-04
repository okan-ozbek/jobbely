import { useEffect, useState } from 'react';
import { getRequirements } from '../../api/client.js';
import type { JobRequirements } from '../../api/client.js';

export function RequirementsPanel({ jobId }: { jobId: string }) {
  const [requirements, setRequirements] = useState<JobRequirements | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    setRequirements(null);
    setError('');

    void getRequirements(jobId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setRequirements(value);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Could not load requirements. Read the original description.');
        }
      });

    return () => controller.abort();
  }, [jobId]);

  return (
    <section className="requirements-panel">
      <h2 className="sidebar-heading">Requirements reading</h2>
      <p className="small-note">
        Skills and reviewed activities, interpreted without AI. The original description remains the
        source of truth.
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : !requirements ? (
        <p role="status">Reading requirements…</p>
      ) : (
        <>
          {(['required', 'preferred', 'contextual'] as const).map((level) => (
            <div key={level}>
              <h3>
                {level === 'contextual'
                  ? 'Additional information'
                  : level === 'required'
                    ? 'Required'
                    : 'Preferred'}
              </h3>
              {requirements.skills.filter((group) => group.importance === level).length ? (
                <ul>
                  {requirements.skills
                    .filter((group) => group.importance === level)
                    .map((group, index) => (
                      <li key={index}>
                        <strong>
                          {group.alternatives
                            .map(
                              (skill) =>
                                `${skill.name}${skill.facet === 'development' ? ' (developing internals)' : ''}`,
                            )
                            .join(' or ')}
                        </strong>
                        <details>
                          <summary>Evidence · line {group.evidence.line}</summary>
                          <p>{group.evidence.excerpt}</p>
                        </details>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="small-note">No recognized skills in this group.</p>
              )}
            </div>
          ))}
          {requirements.experience.map((item, index) => (
            <p key={index}>
              <strong>
                {item.minimumMonths / 12}
                {item.maximumMonths ? `–${item.maximumMonths / 12}` : '+'} years · {item.scope}
              </strong>
              <br />
              {item.evidence.excerpt}
            </p>
          ))}
          {requirements.constraints.length > 0 && (
            <section aria-label="Eligibility review">
              <h3>Eligibility and qualifications to review</h3>
              <p className="small-note">
                Location, authorization and qualifications need confirmation separately from skill
                coverage.
              </p>
              {requirements.constraints.map((item, index) => (
                <p key={index}>
                  <strong>
                    {item.kind} · {item.importance}
                  </strong>
                  <br />
                  {item.evidence.excerpt}
                </p>
              ))}
            </section>
          )}
          {requirements.unparsed.map((item, index) => (
            <p key={index}>
              <strong>Needs review · {item.importance}</strong>
              <br />
              {item.evidence.excerpt}
            </p>
          ))}
          <p className="small-note">{requirements.warnings.join(' ')}</p>
        </>
      )}
    </section>
  );
}
