import type { JobMatchResponse, JobRequirements } from '../../api/client.js';
import { highlightSegments } from './highlights.js';
import { coverageLabel } from './semantic-review.js';

export function QualificationGroups({
  requirements,
  annotations = [],
}: {
  requirements: JobRequirements;
  annotations?: JobMatchResponse['skills'];
}) {
  const additional = requirements.clauses.filter((clause) => clause.importance === 'contextual');

  return (
    <div className="qualification-groups">
      {(['required', 'preferred'] as const).map((level) => {
        const clauses = requirements.clauses.filter((clause) => clause.importance === level);

        const unresolved = new Set([
          ...requirements.unparsed
            .filter((clause) => clause.importance === level)
            .map((clause) => clause.evidence.clauseId),
          ...clauses
            .filter((clause) => clause.unresolvedAlternatives.length > 0)
            .map((clause) => clause.id),
        ]).size;

        return (
          <section
            key={level}
            aria-label={
              level === 'required' ? 'Required qualifications' : 'Preferred qualifications'
            }
          >
            <h2>
              {level === 'required'
                ? 'Required qualifications'
                : 'Preferred qualifications / nice to haves'}
            </h2>
            <p className="small-note">
              {clauses.length} statement(s) · {unresolved} unresolved statement(s). Unknown details
              remain available for review.
            </p>
            {clauses.length ? (
              <ul>
                {clauses.map((clause) => {
                  const start = clause.evidence.start ?? 0;
                  const text = clause.evidence.excerpt;

                  const spans = annotations
                    .filter(
                      (item) =>
                        item.position >= start &&
                        item.position + item.length <= start + text.length,
                    )
                    .map((item) => ({ ...item, position: item.position - start }));

                  return (
                    <li key={clause.id}>
                      {highlightSegments(text, spans).map((segment, index) =>
                        segment.span ? (
                          <mark
                            key={index}
                            className={`keyword-${segment.span.confidence}`}
                            title={`${segment.span.name}: ${segment.span.reason}`}
                          >
                            {segment.text}
                            <span className="sr-only">
                              {' '}
                              ({coverageLabel(segment.span.decision)})
                            </span>
                          </mark>
                        ) : (
                          segment.text
                        ),
                      )}
                      {clause.unresolvedAlternatives.length > 0 && (
                        <p className="small-note">
                          Other alternatives to review: {clause.unresolvedAlternatives.join(' / ')}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="small-note">
                No statements recognized in this group. Check the original description.
              </p>
            )}
          </section>
        );
      })}
      <section aria-label="Additional information">
        <h2>Additional information</h2>
        <p className="small-note">
          Role context, company information and application details. These statements do not add
          skill gaps or match credit.
        </p>
        <details>
          <summary>Read additional information ({additional.length})</summary>
          {additional.map((clause, index) => {
            const heading = requirements.blocks
              .find((block) => block.id === clause.blockId)
              ?.headingPath.join(' / ');

            const previous = additional[index - 1];

            const previousHeading = requirements.blocks
              .find((block) => block.id === previous?.blockId)
              ?.headingPath.join(' / ');

            return (
              <div key={clause.id}>
                {heading && heading !== previousHeading && <h3>{heading}</h3>}
                <p>{clause.evidence.excerpt}</p>
              </div>
            );
          })}
        </details>
      </section>
    </div>
  );
}
