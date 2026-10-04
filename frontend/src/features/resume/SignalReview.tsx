import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { ResumeAnalysis } from '../../api/client.js';

export function SignalReview({ signals, suggestions = [], add, remove }: {
  signals: ResumeAnalysis['skills'];
  suggestions?: ResumeAnalysis['supportedSkills'];
  add: (name: string) => void;
  remove: (signal: ResumeAnalysis['skills'][number]) => void;
}) {
  const [name, setName] = useState('');

  return (
    <section className="resume-panel skills-review">
      <div className="section-heading"><h2>Skills <span>{signals.length}</span></h2></div>
      <p className="small-note">Keep what fits. Remove anything that doesn’t. <Sparkles size={12} /> marks an inferred activity.</p>
      <div className="skill-chips">
        {signals.map((signal) => (
          <span className={`skill-chip ${signal.interpretation === 'interpreted' ? 'skill-chip-inferred' : ''}`} key={signal.id}>
            {signal.interpretation === 'interpreted' && <Sparkles size={12} aria-label="Inferred activity" />}
            <span>{signal.name}</span>
            {(signal.status === 'learning' || signal.status === 'negated' || signal.interpretation === 'ambiguous') && <small>{signal.status === 'learning' ? 'Learning' : signal.status === 'negated' ? 'Denied' : 'Uncertain'}</small>}
            <button type="button" aria-label={`Remove ${signal.name} from skills`} onClick={() => remove(signal)}><X size={13} /></button>
          </span>
        ))}
        {signals.length === 0 && <p className="small-note">Add your skills below.</p>}
      </div>
      <form className="resume-add-row" onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) { add(name); setName(''); }
      }}>
        <label><span>Add a skill</span><input value={name} maxLength={100} list="skills-suggestions" placeholder="e.g. TypeScript" onChange={(event) => setName(event.target.value)} /></label>
        <datalist id="skills-suggestions">{suggestions.map((skill) => <option key={skill.id} value={skill.name} />)}</datalist>
        <button type="submit" className="resume-secondary-button" disabled={!name.trim()}>Add</button>
      </form>
    </section>
  );
}
