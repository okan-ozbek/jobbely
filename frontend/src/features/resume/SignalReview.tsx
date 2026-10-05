import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { ResumeAnalysis, ResumeCorrections } from '../../api/client.js';
import { SkillExperienceChip } from './SkillExperienceChip.js';

export function SignalReview({
  signals,
  suggestions = [],
  add,
  remove,
  analysis,
  corrections,
  correct,
  pending,
}: {
  signals: ResumeAnalysis['skills'];
  suggestions?: ResumeAnalysis['supportedSkills'];
  add: (name: string) => void;
  remove: (signal: ResumeAnalysis['skills'][number]) => void;
  analysis: ResumeAnalysis;
  corrections: ResumeCorrections;
  correct: (changes: ResumeCorrections) => void;
  pending: boolean;
}) {
  const [name, setName] = useState('');

  return (
    <section className="skills-review">
      <div className="section-heading">
        <h2>
          Skills <span>{signals.length}</span>
        </h2>
      </div>
      <p className="small-note">
        Hover for experience; click a skill to edit years. <Sparkles size={12} /> marks an inferred
        activity. Role estimates assume use throughout employment; review before matching.
      </p>
      <div className="skill-chips">
        {signals.map((signal) => (
          <SkillExperienceChip
            key={signal.id}
            signal={signal}
            pending={pending}
            analysis={analysis}
            corrections={corrections}
            correct={correct}
            remove={() => remove(signal)}
          />
        ))}
        {signals.length === 0 && <p className="small-note">Add your skills below.</p>}
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
          <span>Add a skill</span>
          <input
            value={name}
            maxLength={100}
            list="skills-suggestions"
            placeholder="e.g. TypeScript"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <datalist id="skills-suggestions">
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
