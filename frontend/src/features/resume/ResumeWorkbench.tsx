import { useEffect, useRef, useState } from 'react';
import { QualificationReview } from './QualificationReview.js';
import { ArrowRight, Paperclip, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { ResumeAnalysis } from '../../api/client.js';
import { EmploymentReview } from './EmploymentReview.js';
import { SignalReview } from './SignalReview.js';
import type { useResumeAnalysis } from './useResumeAnalysis.js';
import { useDocumentInput } from './documents/useDocumentInput.js';
import { ResumeMatches } from './ResumeMatches.js';
import { Disclosure } from '../../components/Disclosure.js';
import { scrollToSection } from '../../components/motion.js';
import './resume.css';

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
  const [fileName, setFileName] = useState('');
  const analysis = state.analysis;

  const fileWarnings =
    documentInput.document?.warnings.filter(
      (warning) => !warning.startsWith('Reading order is inferred'),
    ) ?? [];

  const matches = useRef<HTMLDivElement>(null);
  const hadAnalysis = useRef(false);

  useEffect(() => {
    if (analysis && !hadAnalysis.current) {
      const frame = requestAnimationFrame(() => scrollToSection(matches.current));

      hadAnalysis.current = true;

      return () => cancelAnimationFrame(frame);
    }

    hadAnalysis.current = !!analysis;
  }, [analysis]);

  return (
    <div className={analysis ? 'resume-workbench has-analysis' : 'resume-workbench'}>
      <div className="resume-start">
        <section
          className="resume-hero"
          aria-labelledby="resume-title"
        >
          <span className="eyebrow">
            <Sparkles size={14} /> A little clarity. A new chapter.
          </span>
          <h1 id="resume-title">
            Your next role.
            <br />
            <span>Starts with you.</span>
          </h1>
          <p>Add your resume. Discover jobs that fit your skills and experience.</p>
        </section>
        <section
          className="resume-composer"
          aria-label="Add your resume"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              state.analyze();
            }}
          >
            {!fileName && (
              <label className="composer-text-label">
                <span className="sr-only">Resume text</span>
                <textarea
                  value={state.text}
                  maxLength={100_000}
                  rows={1}
                  placeholder="Paste your resume here, or attach a file…"
                  onChange={(event) => {
                    state.setText(event.target.value);
                  }}
                />
              </label>
            )}
            {fileName && (
              <div className="attached-file">
                <Paperclip size={14} />
                <span>{fileName}</span>
                <button
                  type="button"
                  aria-label="Remove attached resume"
                  onClick={() => {
                    documentInput.clear();
                    state.clear();
                    setFileName('');
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="composer-actions">
              {state.text && !fileName && (
                <button
                  className="composer-clear"
                  type="button"
                  aria-label="Clear resume"
                  onClick={() => {
                    state.clear();
                    documentInput.clear();
                  }}
                >
                  <X size={16} />
                </button>
              )}
              {!fileName && (
                <label className="attach-button">
                  <Paperclip size={17} />
                  <span>Attach resume</span>
                  <input
                    className="sr-only"
                    type="file"
                    accept=".pdf,.docx"
                    disabled={documentInput.loading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file) {
                        setFileName(file.name);
                        void documentInput.select(file);
                      }

                      event.target.value = '';
                    }}
                  />
                </label>
              )}
              <button
                className="primary-button"
                type="submit"
                disabled={!state.text.trim() || state.loading || documentInput.loading}
              >
                {state.loading ? 'Reading resume…' : 'Review my resume'} <ArrowRight size={16} />
              </button>
            </div>
          </form>
          {documentInput.loading && (
            <div
              className="document-progress"
              role="status"
            >
              Reading your file…{' '}
              <button
                type="button"
                onClick={documentInput.cancel}
              >
                Cancel
              </button>
            </div>
          )}
          {documentInput.error && (
            <p
              className="error-state"
              role="alert"
            >
              {documentInput.error}
            </p>
          )}
          {fileWarnings.length > 0 && (
            <p
              className="small-note"
              role="status"
            >
              {fileWarnings.join(' ')}
            </p>
          )}
        </section>
        <p className="composer-note">
          <ShieldCheck size={14} /> Your resume isn’t saved. PDF or DOCX, up to 5 MB.
        </p>
        <Disclosure
          className="privacy-details"
          summary="How your resume is handled"
        >
          <p>
            Files are read on your device. When you continue, the text is sent to Jobbely for
            temporary analysis. Your profile stays in this tab and clears when you reload. PDFs
            support up to 20 pages; scanned documents need pasted text.
          </p>
        </Disclosure>
        <div
          className="home-companies"
          aria-label="Some companies in the directory"
        >
          <span>Explore opportunities from companies like</span>
          <div>
            {['databricks', 'apple', 'meta', 'figma', 'spotify'].map((slug) => (
              <img
                key={slug}
                src={`/logos/${slug}.${slug === 'meta' ? 'jpg' : 'png'}`}
                alt={
                  slug === 'databricks'
                    ? 'Databricks'
                    : slug.charAt(0).toUpperCase() + slug.slice(1)
                }
                width={28}
                height={28}
              />
            ))}
          </div>
        </div>
      </div>
      {(state.loading || analysis) && (
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
              : ''}
        </p>
      )}
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
          <Disclosure
            className="profile-review"
            summary={
              <>
                Review your profile <span>Skills, experience & location</span>
              </>
            }
          >
            <div className="profile-review-content">
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
                  <strong>{analysis.skills.length + analysis.competencies.length}</strong>
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
                      Confirm your current location. Work locations do not establish where you live
                      or your work authorization.
                    </p>
                  </section>
                  <QualificationReview
                    analysis={analysis}
                    corrections={state.corrections}
                    correct={state.correct}
                  />
                  <SignalReview
                    signals={[...analysis.skills, ...analysis.competencies]}
                    suggestions={analysis.supportedSkills}
                    add={(name) =>
                      state.addSignal(
                        analysis.competencies.some(
                          (item) => item.name.toLowerCase() === name.trim().toLowerCase(),
                        )
                          ? 'competencies'
                          : 'skills',
                        name,
                      )
                    }
                    remove={(signal) =>
                      state.removeSignal(
                        analysis.competencies.some((item) => item.id === signal.id)
                          ? 'competencies'
                          : 'skills',
                        signal,
                      )
                    }
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
            </div>
          </Disclosure>
          <div
            ref={matches}
            className="matches-anchor"
          >
            <ResumeMatches
              analysis={analysis}
              pending={state.loading || !!state.error}
              openJob={openJob}
              onReviewed={onReviewed}
            />
          </div>
        </>
      )}
    </div>
  );
}
