import { useState } from 'react';
import type { ResumeAnalysis } from '../../api/client.js';

const labels = {
  mentioned: 'Listed claim',
  work_evidenced: 'Supporting statement',
  learning: 'Learning',
  negated: 'Negative claim',
  user_confirmed: 'User confirmed',
};

export function SignalReview({
  title,
  signals,
  suggestions = [],
  add,
  remove,
}: {
  title: string;
  signals: ResumeAnalysis['skills'];
  suggestions?: ResumeAnalysis['supportedSkills'];
  add: (name: string) => void;
  remove: (signal: ResumeAnalysis['skills'][number]) => void;
}) {
  const [name, setName] = useState('');
  const listId = `${title.toLowerCase()}-suggestions`;

  return (
    <section className="resume-panel">
      <div className="section-heading">
        <h2>
          {title} <span>{signals.length}</span>
        </h2>
      </div>
      <p className="small-note">
        Resume claims, with their evidence. Detection does not verify proficiency.
      </p>
      <div className="resume-signals">
        {signals.map((signal) => (
          <article
            className="resume-signal"
            key={signal.id}
          >
            <div className="resume-signal-heading">
              <strong>{signal.name}</strong>
              <button
                type="button"
                className="resume-text-button"
                aria-label={`Remove ${signal.name} from ${title.toLowerCase()}`}
                onClick={() => remove(signal)}
              >
                Remove
              </button>
            </div>
            <span className={`resume-status resume-status-${signal.status}`}>
              {labels[signal.status]}
            </span>
            {signal.evidence.length > 0 && (
              <details>
                <summary>View evidence</summary>
                {signal.evidence.map((evidence, index) => (
                  <blockquote key={`${evidence.lineId}-${index}`}>
                    <span>{evidence.lineId.replace('line-', 'Line ')}</span>
                    {evidence.excerpt}
                  </blockquote>
                ))}
              </details>
            )}
            {signal.status !== 'user_confirmed' && (
              <button
                type="button"
                className="resume-text-button"
                onClick={() => add(signal.name)}
              >
                Confirm this claim
              </button>
            )}
          </article>
        ))}
        {signals.length === 0 && (
          <p className="small-note">
            No supported {title.toLowerCase()} detected. Add an explicit claim below.
          </p>
        )}
      </div>
      <form
        className="resume-add-row"
        onSubmit={(event) => {
          event.preventDefault();

          if (name.trim()) {
            add(name);
            setName('');
          }
        }}
      >
        <label>
          <span>Add {title === 'Skills' ? 'a skill' : 'a competency'}</span>
          <input
            value={name}
            maxLength={100}
            list={listId}
            placeholder={title === 'Skills' ? 'e.g. TypeScript' : 'e.g. Mentoring'}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <datalist id={listId}>
          {suggestions.map((skill) => (
            <option
              key={skill.id}
              value={skill.name}
            />
          ))}
        </datalist>
        <button
          type="submit"
          className="resume-secondary-button"
          disabled={!name.trim()}
        >
          Add
        </button>
      </form>
    </section>
  );
}
