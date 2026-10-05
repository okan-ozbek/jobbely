import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { GlassSelect } from '../../components/GlassSelect.js';
import type { ResumeAnalysis, ResumeCorrections } from '../../api/client.js';

type Education = NonNullable<ResumeCorrections['education']>[number];

const fields = {
  'computer-science': 'Computer science / software engineering',
  engineering: 'Engineering',
  mathematics: 'Mathematics / statistics',
  physics: 'Physics',
  business: 'Business / economics',
  other: 'Another field',
  unknown: 'Field not confirmed',
};

export function QualificationReview({
  analysis,
  corrections,
  correct,
  children,
}: {
  analysis: ResumeAnalysis;
  corrections: ResumeCorrections;
  correct: (changes: ResumeCorrections) => void;
  children: ReactNode;
}) {
  const education = corrections.education ?? analysis.education ?? [];

  const nextDegree = (['bachelor', 'master', 'doctorate'] as const).find(
    (level) =>
      !education.some(
        (degree) =>
          degree.level === level && degree.field === 'unknown' && degree.completion === 'unknown',
      ),
  );

  const saveEducation = (entries: Education[]) =>
    correct({
      education: [...new Map(entries.map((entry) => [JSON.stringify(entry), entry])).values()],
    });

  const editDegree = (index: number, changes: Partial<Education>) =>
    saveEducation(
      education.map((entry, position) => (position === index ? { ...entry, ...changes } : entry)),
    );

  return (
    <section className="resume-panel qualification-review">
      <h2>Education & skill experience</h2>
      <p className="small-note">
        Review your education, then check the experience behind each skill.
      </p>
      {education.map((degree, index) => (
        <div
          className="qualification-entry"
          key={index}
        >
          <label>
            <span>Degree</span>
            <GlassSelect
              aria-label={`Degree ${index + 1}`}
              value={degree.level}
              onValueChange={(value) => editDegree(index, { level: value as Education['level'] })}
            >
              <option value="bachelor">Bachelor · BS / BSc / BA</option>
              <option value="master">Master · MS / MSc / MA</option>
              <option value="doctorate">Doctorate · PhD</option>
            </GlassSelect>
          </label>
          <label>
            <span>Subject</span>
            <GlassSelect
              aria-label={`Degree subject ${index + 1}`}
              value={degree.field}
              onValueChange={(value) => editDegree(index, { field: value as Education['field'] })}
            >
              {Object.entries(fields).map(([value, label]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              ))}
            </GlassSelect>
          </label>
          <label>
            <span>Completion</span>
            <GlassSelect
              aria-label={`Degree completion ${index + 1}`}
              value={degree.completion}
              onValueChange={(value) =>
                editDegree(index, { completion: value as Education['completion'] })
              }
            >
              <option value="completed">Completed</option>
              <option value="in-progress">In progress</option>
              <option value="unknown">Not confirmed</option>
            </GlassSelect>
          </label>
          <button
            type="button"
            className="qualification-remove"
            aria-label={`Remove degree ${index + 1}`}
            onClick={() =>
              correct({ education: education.filter((_, position) => position !== index) })
            }
          >
            <X size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="resume-secondary-button"
        disabled={education.length >= 20 || !nextDegree}
        onClick={() =>
          nextDegree &&
          saveEducation([
            ...education,
            { level: nextDegree, field: 'unknown', completion: 'unknown' },
          ])
        }
      >
        Add a degree
      </button>
      {children}
    </section>
  );
}
