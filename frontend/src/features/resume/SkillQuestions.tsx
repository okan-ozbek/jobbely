import type { ConceptReview, JobMatchResponse } from '../../api/client.js';

export function SkillQuestions({
  questions,
  answer,
}: {
  questions: NonNullable<JobMatchResponse['skills'][number]['suggestion']>[];
  answer: (review: ConceptReview) => void;
}) {
  if (!questions.length) {
    return null;
  }

  return (
    <section
      className="skill-questions"
      aria-label="Skills to confirm"
    >
      <h3>Skills your resume may leave out</h3>
      <p className="small-note">
        These are questions, with no added match credit. Answers update your temporary profile;
        review it before comparing again.
      </p>
      <ul>
        {questions.map((question) => (
          <li key={`${question.id}:${question.facet}`}>
            <p>
              <strong>
                {question.name} ·{' '}
                {question.facet === 'development'
                  ? 'developing internals'
                  : question.facet === 'usage'
                    ? 'tool usage'
                    : 'experience'}
              </strong>
              <br />
              {question.question}
            </p>
            <div className="skill-question-actions">
              {(
                [
                  ['confirmed', 'Yes, I have'],
                  ['denied', 'No, I haven’t'],
                  ['unsure', 'Not sure'],
                ] as const
              ).map(([value, label]) => (
                <button
                  className="resume-secondary-button"
                  key={value}
                  onClick={() => answer({ id: question.id, facet: question.facet, answer: value })}
                  aria-label={`${label} · ${question.name} ${question.facet}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
