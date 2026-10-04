import { useState } from 'react';
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
}: {
  analysis: ResumeAnalysis;
  corrections: ResumeCorrections;
  correct: (changes: ResumeCorrections) => void;
}) {
  const education = corrections.education ?? analysis.education ?? [];
  const tenure = corrections.skillTenure ?? analysis.skillTenure ?? [];
  const [skillId, setSkillId] = useState('');
  const [years, setYears] = useState('');

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
        Review degree level, subject and completion. Only explicit or reviewed years establish
        experience in a particular skill.
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
        className="text-button"
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
      <h3>Skill experience</h3>
      {tenure.map((claim) => (
        <div
          className="tenure-entry"
          key={claim.skillId}
        >
          <span>
            {analysis.supportedSkills.find((skill) => skill.id === claim.skillId)?.name ??
              claim.skillId}
          </span>
          <label>
            <span>Years</span>
            <input
              aria-label={`Years of experience in ${claim.skillId}`}
              type="number"
              min={0}
              max={50}
              step={0.25}
              value={claim.months / 12}
              onChange={(event) =>
                correct({
                  skillTenure: tenure.map((entry) =>
                    entry.skillId === claim.skillId
                      ? {
                          ...entry,
                          months: Math.round(
                            Math.min(50, Math.max(0, Number(event.target.value))) * 12,
                          ),
                        }
                      : entry,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className="qualification-remove"
            aria-label={`Remove ${claim.skillId} experience`}
            onClick={() =>
              correct({ skillTenure: tenure.filter((entry) => entry.skillId !== claim.skillId) })
            }
          >
            <X size={15} />
          </button>
        </div>
      ))}
      <form
        className="tenure-add"
        onSubmit={(event) => {
          event.preventDefault();

          if (!skillId || !years || Number(years) < 0 || Number(years) > 50) {
            return;
          }

          correct({
            skillTenure: [
              ...tenure.filter((claim) => claim.skillId !== skillId),
              { skillId, months: Math.round(Number(years) * 12) },
            ],
          });

          setSkillId('');
          setYears('');
        }}
      >
        <GlassSelect
          aria-label="Skill for experience"
          value={skillId}
          onValueChange={setSkillId}
        >
          <option value="">Choose a skill</option>
          {analysis.supportedSkills.map((skill) => (
            <option
              key={skill.id}
              value={skill.id}
            >
              {skill.name}
            </option>
          ))}
        </GlassSelect>
        <input
          aria-label="Years in selected skill"
          placeholder="Years"
          type="number"
          min={0}
          max={50}
          step={0.25}
          value={years}
          onChange={(event) => setYears(event.target.value)}
        />
        <button
          type="submit"
          disabled={!skillId || years === ''}
        >
          Add
        </button>
      </form>
      <p className="small-note">
        Use professional experience only. Concurrent work is counted once; using a skill during a
        role does not establish its full duration. Also include the skill in your reviewed skills.
      </p>
    </section>
  );
}
