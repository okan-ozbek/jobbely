import { useEffect, useState } from 'react';
import { ArrowUpRight, FileText } from 'lucide-react';
import type { ResumeAnalysis } from '../../api/client.js';
import { EmploymentReview } from './EmploymentReview.js';
import { SignalReview } from './SignalReview.js';
import type { useResumeAnalysis } from './useResumeAnalysis.js';
import { useDocumentInput } from './documents/useDocumentInput.js';
import { ResumeMatches } from './ResumeMatches.js';
import './resume.css';

interface Example {
  id: string;
  name: string;
  text: string;
}

function formatDuration(duration: ResumeAnalysis['experience']['professional']) {
  const label = (months: number) => `${Math.floor(months / 12)}y ${months % 12}m`;

  if (!duration.maximumMonths && duration.unknownEntries) {
    return 'Unknown';
  }

  return duration.minimumMonths === duration.maximumMonths
    ? label(duration.minimumMonths)
    : `${label(duration.minimumMonths)} – ${label(duration.maximumMonths)}`;
}

export function ResumeWorkbench({
  openJob,
  state,
  onReviewed,
}: {
  openJob: (id: string) => void;
  state: ReturnType<typeof useResumeAnalysis>;
  onReviewed: (analysis: ResumeAnalysis | null) => void;
}) {
  const documentInput = useDocumentInput(state.setText);
  const [examples, setExamples] = useState<Example[]>([]);
  const [exampleId, setExampleId] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    void fetch('/resume-evaluation.json', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        const value = (await response.json()) as { resumes: Example[] };

        if (!controller.signal.aborted) {
          setExamples(value.resumes);
        }
      })
      .catch(() => {
        /* Optional synthetic examples do not block private input. */
      });

    return () => controller.abort();
  }, []);

  const analysis = state.analysis;

  return (
    <div className="resume-workbench">
      <section className="hero">
        <div className="hero-title">
          <h1>
            Read your resume.
            <br />
            <span>See what comes through.</span>
          </h1>
        </div>
        <p>
          Inspect the text, review the claims, and understand your experience. A clear reading
          preview, without AI.
        </p>
      </section>
      <section
        className="resume-input-panel"
        aria-labelledby="resume-input-heading"
      >
        <div className="section-heading">
          <h2 id="resume-input-heading">
            <FileText size={21} /> Resume analysis
          </h2>
          <span className="resume-status">Text · PDF · DOCX · English</span>
        </div>
        <p className="small-note">
          Your text is sent to Jobbely for temporary analysis. It is not saved as a resume or
          profile. Corrections stay in this tab; reloading clears them. Files are read locally in a
          separate browser worker; only text you choose to analyze is sent to Jobbely.
        </p>
        <div className="resume-file-input">
          <label>
            <span>Read a PDF or DOCX · maximum 5 MiB / 20 PDF pages</span>
            <input
              type="file"
              accept=".pdf,.docx"
              disabled={documentInput.loading}
              onChange={(event) => {
                const file = event.target.files?.[0];

                setExampleId('');

                if (file) {
                  void documentInput.select(file);
                }

                event.target.value = '';
              }}
            />
          </label>
          {documentInput.loading && (
            <button
              type="button"
              className="resume-secondary-button"
              onClick={documentInput.cancel}
            >
              Cancel document reading
            </button>
          )}
          {documentInput.loading && <p role="status">Reading locally…</p>}
          {documentInput.error && <p role="alert">{documentInput.error}</p>}
          {documentInput.document && (
            <details className="document-preview">
              <summary>
                Document reading order · {documentInput.document.format.toUpperCase()} ·{' '}
                {documentInput.document.blocks.length} blocks
              </summary>
              <p className="small-note">
                Review this order and edit the text below before analysis.{' '}
                {documentInput.document.warnings.join(' ')}
              </p>
              <ol className="resume-lines">
                {documentInput.document.blocks.map((block) => (
                  <li key={block.order}>
                    <span className="resume-line-number">{block.order}</span>
                    <div>
                      <span className="resume-section-label">
                        {block.page ? `Page ${block.page}` : block.kind}
                      </span>
                      <span className="resume-line-text">{block.text}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
        {examples.length > 0 && (
          <div className="resume-example-row">
            <label>
              <span>Try a synthetic example</span>
              <select
                value={exampleId}
                onChange={(event) => {
                  setExampleId(event.target.value);

                  const example = examples.find((item) => item.id === event.target.value);

                  if (example) {
                    documentInput.clear();
                    state.setText(example.text);
                  }
                }}
              >
                <option value="">Choose an example</option>
                {examples.map((example) => (
                  <option
                    key={example.id}
                    value={example.id}
                  >
                    {example.name}
                  </option>
                ))}
              </select>
            </label>
            <span>Fictional candidates, for testing.</span>
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            state.analyze();
          }}
        >
          <label className="resume-text-label">
            <span>Resume text</span>
            <textarea
              value={state.text}
              maxLength={100_000}
              rows={12}
              placeholder={
                'Paste your resume here…\n\nExperience\nSoftware Engineer | Example Company\nJan 2020 - Dec 2023\nBuilt services using TypeScript and PostgreSQL.\n\nSkills\nTypeScript, PostgreSQL'
              }
              onChange={(event) => {
                setExampleId('');
                state.setText(event.target.value);
              }}
            />
          </label>
          <div className="resume-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={!state.text.trim() || state.loading || documentInput.loading}
            >
              Analyze text <ArrowUpRight size={16} />
            </button>
            <button
              className="resume-secondary-button"
              type="button"
              onClick={() => {
                state.clear();
                documentInput.clear();
                setExampleId('');
              }}
            >
              Clear resume
            </button>
            <span>{state.text.length.toLocaleString()} / 100,000 characters</span>
          </div>
        </form>
      </section>
      <p
        className="resume-request-status"
        role="status"
        aria-live="polite"
      >
        {state.loading
          ? analysis
            ? 'Updating your review and experience totals…'
            : 'Reading your resume…'
          : analysis
            ? `Analysis as of ${analysis.analysisDate}. Changes recalculate automatically.`
            : 'Paste text or choose an example to begin.'}
      </p>
      {state.error && (
        <div
          className="error-state"
          role="alert"
        >
          {state.error}
          {analysis && ' Totals below are from the last successful analysis.'}
        </div>
      )}
      {analysis && (
        <>
          <div
            className="resume-summary"
            aria-busy={state.loading}
          >
            <div>
              <span>Professional experience</span>
              <strong>{formatDuration(analysis.experience.professional)}</strong>
              <small>
                Overlapping roles counted once.
                {analysis.experience.professional.unknownEntries > 0 &&
                  ` ${analysis.experience.professional.unknownEntries} role(s) have unknown duration.`}
              </small>
            </div>
            <div>
              <span>Internships</span>
              <strong>{formatDuration(analysis.experience.internships)}</strong>
              <small>Separate from professional experience.</small>
            </div>
            <div>
              <span>Detected skills</span>
              <strong>{analysis.skills.length}</strong>
              <small>
                {analysis.supportedSkills.length} supported concepts; manual additions welcome.
              </small>
            </div>
          </div>
          {analysis.warnings.length > 0 && (
            <aside
              className="resume-warnings"
              aria-label="Review warnings"
            >
              <strong>Worth reviewing</strong>
              <ul>
                {analysis.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </aside>
          )}
          <div className="resume-layout">
            <section
              className="resume-panel resume-reading"
              aria-labelledby="resume-reading-heading"
            >
              <div className="section-heading">
                <h2 id="resume-reading-heading">Reading preview</h2>
              </div>
              <p className="small-note">
                Our interpretation of your pasted text, not an exact simulation of a particular ATS.
                Line numbers refer to the original text below.
              </p>
              <ol className="resume-lines">
                {analysis.document.lines.map((line) => (
                  <li
                    className={line.heading ? 'resume-line-heading' : ''}
                    key={line.id}
                  >
                    <span className="resume-line-number">{line.number}</span>
                    <div>
                      {line.heading && <span className="resume-section-label">{line.section}</span>}
                      <span className="resume-line-text">{line.text || '\u00a0'}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            <div className="resume-profile">
              <section className="resume-panel">
                <div className="section-heading">
                  <h2>Current location</h2>
                  <span className="resume-status">
                    {analysis.location.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <label className="resume-location">
                  <span>City and country</span>
                  <input
                    value={state.corrections.location ?? analysis.location.value}
                    maxLength={200}
                    placeholder="e.g. Amsterdam, Netherlands"
                    onChange={(event) => state.correct({ location: event.target.value })}
                  />
                </label>
                <p className="small-note">
                  Confirm your current location. Work locations do not establish where you live or
                  your work authorization.
                </p>
              </section>
              <SignalReview
                review={state.reviewSignal}
                title="Skills"
                signals={analysis.skills}
                suggestions={analysis.supportedSkills}
                add={(name) => state.addSignal('skills', name)}
                remove={(signal) => state.removeSignal('skills', signal)}
              />
              <SignalReview
                review={state.reviewSignal}
                title="Competencies"
                signals={analysis.competencies}
                add={(name) => state.addSignal('competencies', name)}
                remove={(signal) => state.removeSignal('competencies', signal)}
              />
            </div>
          </div>
          <EmploymentReview
            entries={analysis.employment}
            corrections={state.corrections.employment ?? []}
            edit={state.editEmployment}
            add={state.addEmployment}
          />
          {analysis.experience.relevant.length > 0 && (
            <section className="resume-panel">
              <h2>Experience by function</h2>
              <div className="resume-relevant">
                {analysis.experience.relevant.map((item) => (
                  <div key={item.category}>
                    <span>{item.category.replaceAll('-', ' ')}</span>
                    <strong>{formatDuration(item.duration)}</strong>
                    {item.duration.unknownEntries > 0 && (
                      <small>{item.duration.unknownEntries} undated role(s)</small>
                    )}
                  </div>
                ))}
              </div>
              <p className="small-note">
                Based on reviewed role functions, not years using every listed skill. Projects,
                volunteering and internships are excluded.
              </p>
            </section>
          )}
          <ResumeMatches
            analysis={analysis}
            pending={state.loading || !!state.error}
            openJob={openJob}
            onReviewed={onReviewed}
          />
        </>
      )}
    </div>
  );
}
