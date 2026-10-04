import type { EmploymentCorrection, ResumeAnalysis } from '../../api/client.js';

const functions = [
  ['engineering', 'Engineering'],
  ['data-ai', 'Data & AI'],
  ['research', 'Research'],
  ['quant-trading', 'Quant & trading'],
  ['product', 'Product'],
  ['design', 'Design'],
  ['sales', 'Sales'],
  ['marketing', 'Marketing'],
  ['customer-success', 'Customer success'],
  ['people', 'People & recruiting'],
  ['finance', 'Finance'],
  ['legal', 'Legal'],
  ['security-it', 'Security & IT'],
  ['operations', 'Operations'],
  ['manufacturing', 'Manufacturing'],
  ['retail', 'Retail'],
  ['creative', 'Creative'],
  ['unclassified', 'Unknown function'],
] as const;

export function EmploymentReview({
  entries,
  corrections,
  edit,
  add,
}: {
  entries: ResumeAnalysis['employment'];
  corrections: EmploymentCorrection[];
  edit: (id: string, changes: Omit<EmploymentCorrection, 'id'>) => void;
  add: () => void;
}) {
  return (
    <section className="resume-panel">
      <div className="section-heading">
        <h2>
          Employment <span>{entries.length}</span>
        </h2>
        <button
          type="button"
          className="resume-text-button"
          onClick={add}
        >
          Add a role
        </button>
      </div>
      <p className="small-note">
        Review employers, function and dates. Use Jan 2020, 2020-01 or a year; Present is supported.
        End months are included, up to the analysis month.
      </p>
      {entries.map((entry) => {
        const draft = { ...entry, ...corrections.find((correction) => correction.id === entry.id) };

        return (
          <fieldset
            className="resume-employment"
            key={entry.id}
          >
            <legend>{entry.title || 'New role'}</legend>
            <div className="resume-fields">
              <label>
                <span>Employer</span>
                <input
                  value={draft.employer}
                  maxLength={200}
                  onChange={(event) => edit(entry.id, { employer: event.target.value })}
                />
              </label>
              <label>
                <span>Role title</span>
                <input
                  value={draft.title}
                  maxLength={200}
                  onChange={(event) => edit(entry.id, { title: event.target.value })}
                />
              </label>
              <label>
                <span>Start date</span>
                <input
                  value={draft.start}
                  maxLength={40}
                  placeholder="Jan 2020"
                  onChange={(event) => edit(entry.id, { start: event.target.value })}
                />
              </label>
              <label>
                <span>End date</span>
                <input
                  value={draft.end}
                  maxLength={40}
                  placeholder="Present"
                  onChange={(event) => edit(entry.id, { end: event.target.value })}
                />
              </label>
              <label>
                <span>Function</span>
                <select
                  value={draft.category}
                  onChange={(event) =>
                    edit(entry.id, {
                      category: event.target
                        .value as ResumeAnalysis['employment'][number]['category'],
                    })
                  }
                >
                  {functions.map(([value, name]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Experience type</span>
                <select
                  value={draft.kind}
                  onChange={(event) =>
                    edit(entry.id, {
                      kind: event.target.value as ResumeAnalysis['employment'][number]['kind'],
                    })
                  }
                >
                  <option value="employment">Employment</option>
                  <option value="internship">Internship</option>
                  <option value="project">Project</option>
                  <option value="volunteering">Volunteering</option>
                </select>
              </label>
              <label>
                <span>Employer relationship</span>
                <select
                  value={draft.relationship}
                  onChange={(event) =>
                    edit(entry.id, {
                      relationship: event.target
                        .value as ResumeAnalysis['employment'][number]['relationship'],
                    })
                  }
                >
                  <option value="unknown">Not confirmed</option>
                  <option value="direct">Direct employment</option>
                  <option value="client">Client assignment</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              className="resume-text-button"
              onClick={() => edit(entry.id, { removed: true })}
            >
              Remove role
            </button>
          </fieldset>
        );
      })}
      {entries.length === 0 && (
        <p className="small-note">
          No recognized role blocks yet. Add a role to review your dated experience.
        </p>
      )}
    </section>
  );
}
