import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import type { ResumeAnalysis, ResumeCorrections } from '../../api/client.js';

function duration(months: number) {
  const years = Math.floor(months / 12);
  const remainder = months % 12;

  return (
    [years ? `${years}y` : '', remainder ? `${remainder}m` : ''].filter(Boolean).join(' ') || '0m'
  );
}

export function SkillExperienceChip({
  signal,
  analysis,
  corrections,
  correct,
  remove,
  pending,
}: {
  signal: ResumeAnalysis['skills'][number];
  analysis: ResumeAnalysis;
  corrections: ResumeCorrections;
  correct: (changes: ResumeCorrections) => void;
  remove: () => void;
  pending: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [years, setYears] = useState('');
  const tenure = corrections.skillTenure ?? analysis.skillTenure ?? [];
  const claim = tenure.find((entry) => entry.skillId === signal.id);
  const estimate = analysis.skillTenureEstimates?.find((entry) => entry.skillId === signal.id);
  const roles = analysis.employment.filter((role) => estimate?.roleIds.includes(role.id));

  const experience = claim
    ? `${duration(claim.months)} · ${corrections.skillTenure?.some((entry) => entry.skillId === signal.id) ? 'Reviewed' : 'From resume'}`
    : estimate
      ? `${duration(estimate.minimumMonths)}${estimate.minimumMonths === estimate.maximumMonths ? '' : `–${duration(estimate.maximumMonths)}`} · Estimated`
      : 'Experience not provided';

  const canSave =
    years.trim() !== '' &&
    Number.isFinite(Number(years)) &&
    Number(years) >= 0 &&
    Number(years) <= 50 &&
    (!!claim || tenure.length < 100);

  const show = () => {
    clearTimeout(hideTimer.current);
    setRect(trigger.current!.getBoundingClientRect());
  };

  const hideAfterPointerLeaves = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setRect(null), 150);
  };

  useEffect(() => {
    const hide = () => {
      clearTimeout(hideTimer.current);
      setRect(null);
    };

    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);

    return () => {
      clearTimeout(hideTimer.current);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);

  return (
    <>
      <span
        className={`skill-chip ${signal.interpretation === 'interpreted' ? 'skill-chip-inferred' : ''}`}
      >
        <button
          type="button"
          ref={trigger}
          className="skill-experience-trigger"
          aria-label={`Edit ${signal.name} experience`}
          aria-haspopup="dialog"
          disabled={pending}
          aria-describedby={rect && !pending ? `${id}-preview` : undefined}
          onMouseEnter={show}
          onMouseLeave={hideAfterPointerLeaves}
          onFocus={show}
          onBlur={() => setRect(null)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setRect(null);
            }
          }}
          onClick={() => {
            setRect(null);

            setYears(
              claim
                ? String(Number((claim.months / 12).toFixed(4)))
                : estimate?.minimumMonths === estimate?.maximumMonths && estimate
                  ? String(Number((estimate.minimumMonths / 12).toFixed(4)))
                  : '',
            );

            dialog.current!.showModal();
          }}
        >
          {signal.interpretation === 'interpreted' && (
            <Sparkles
              size={12}
              aria-label="Inferred activity"
            />
          )}
          {signal.name}
          {(signal.status === 'learning' ||
            signal.status === 'negated' ||
            signal.interpretation === 'ambiguous') && (
            <small>
              {signal.status === 'learning'
                ? 'Learning'
                : signal.status === 'negated'
                  ? 'Denied'
                  : 'Uncertain'}
            </small>
          )}
        </button>
        <button
          type="button"
          aria-label={`Remove ${signal.name} from skills`}
          onClick={remove}
        >
          <X size={13} />
        </button>
      </span>
      {rect &&
        !pending &&
        createPortal(
          <div
            role="tooltip"
            id={`${id}-preview`}
            className="coverage-context skill-experience-preview"
            onMouseEnter={() => clearTimeout(hideTimer.current)}
            onMouseLeave={hideAfterPointerLeaves}
            style={{
              width: Math.min(320, window.innerWidth - 32),
              left: Math.max(
                16,
                Math.min(rect.left, window.innerWidth - Math.min(320, window.innerWidth - 32) - 16),
              ),
              ...(window.innerHeight - rect.bottom < 280
                ? { bottom: window.innerHeight - rect.top + 8 }
                : { top: rect.bottom + 8 }),
            }}
          >
            <strong>{signal.name}</strong>
            <span>{experience}</span>
            {!claim && estimate && (
              <small>Assumes use throughout the linked roles. Overlapping months count once.</small>
            )}
            {!claim && roles.length > 0 && (
              <ul>
                {roles.map((role) => (
                  <li key={role.id}>
                    {role.employer} · {role.start}–{role.end}
                  </li>
                ))}
              </ul>
            )}
            <small>Click to review or change years.</small>
          </div>,
          document.body,
        )}
      {createPortal(
        <dialog
          ref={dialog}
          className="skill-experience-dialog resume-workbench"
          aria-labelledby={`${id}-title`}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();

              if (!canSave) {
                return;
              }

              correct({
                skillTenure: [
                  ...tenure.filter((entry) => entry.skillId !== signal.id),
                  { skillId: signal.id, months: Math.round(Number(years) * 12) },
                ],
              });

              dialog.current!.close();
            }}
          >
            <div className="section-heading">
              <h2 id={`${id}-title`}>{signal.name}</h2>
              <button
                type="button"
                className="qualification-remove"
                aria-label="Close experience editor"
                onClick={() => dialog.current!.close()}
              >
                <X size={18} />
              </button>
            </div>
            <p className="small-note">{experience}</p>
            {!claim && estimate && (
              <p className="small-note">
                Estimated from {roles.map((role) => role.employer).join(', ')}. Adjust if you used
                this skill for only part of a role.
              </p>
            )}
            <label>
              <span>Professional experience in years</span>
              <input
                type="number"
                min={0}
                max={50}
                step="any"
                value={years}
                onChange={(event) => setYears(event.target.value)}
              />
            </label>
            <p className="small-note">
              Use 0 to record no experience. Projects, learning and internships are excluded.
            </p>
            <button
              type="submit"
              className="primary-button"
              disabled={!canSave}
            >
              Save experience
            </button>
          </form>
        </dialog>,
        document.body,
      )}
    </>
  );
}
