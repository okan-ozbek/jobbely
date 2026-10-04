import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, CircleHelp, Clock3, FlaskConical, Info } from 'lucide-react';
import type { Company } from '../api/client.js';
import { createPortal } from 'react-dom';

const coverage = {
  not_onboarded: {
    label: 'Not connected',
    explanation:
      'This company has no connected source. Its listing count does not establish employer coverage.',
    icon: CircleHelp,
  },
  partial: {
    label: 'Partial coverage',
    explanation: 'A source is connected, but complete employer coverage has not been verified.',
    icon: Info,
  },
  stale: {
    label: 'Refresh overdue',
    explanation:
      'The latest complete source check is over 36 hours old. Stored listings may have changed.',
    icon: Clock3,
  },
  blocked: {
    label: 'Refresh failed',
    explanation:
      'The latest source refresh failed. Stored listings do not establish current availability or complete coverage.',
    icon: AlertCircle,
  },
  healthy: {
    label: 'Full coverage',
    explanation:
      'Connected sources have verified scope and a successful complete refresh under the current source checks.',
    icon: CheckCircle2,
  },
  demo: {
    label: 'Sample source',
    explanation: 'These listings are synthetic examples, not active vacancies.',
    icon: FlaskConical,
  },
};

export function CoverageStatus({ company }: { company: Company }) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const item = coverage[company.status];
  const Icon = item.icon;

  const show = () => setRect(root.current!.getBoundingClientRect());

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setRect(null);
      }
    };

    window.addEventListener('pointerdown', dismiss);

    const hide = () => setRect(null);

    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);

    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);

  return (
    <span
      ref={root}
      className={`coverage-status coverage-${company.status}`}
      onMouseEnter={show}
      onMouseLeave={() => setRect(null)}
    >
      <button
        type="button"
        aria-label={`${company.name}: ${item.label}`}
        aria-describedby={rect ? id : undefined}
        aria-expanded={!!rect}
        onFocus={show}
        onBlur={() => setRect(null)}
        onClick={show}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setRect(null);
          }
        }}
      >
        <Icon size={15} />
      </button>
      {rect &&
        createPortal(
          <span
            role="tooltip"
            id={id}
            className="coverage-context"
            style={{
              width: Math.min(280, window.innerWidth - 32),
              left: Math.max(
                16,
                Math.min(
                  rect.left - 30,
                  window.innerWidth - Math.min(280, window.innerWidth - 32) - 16,
                ),
              ),
              ...(window.innerHeight - rect.bottom < 210
                ? { bottom: window.innerHeight - rect.top + 8 }
                : { top: rect.bottom + 8 }),
            }}
          >
            <strong>{item.label}</strong>
            <span>{item.explanation}</span>
            <small>
              {company.lastCheckedAt
                ? `Last complete check: ${new Date(company.lastCheckedAt).toLocaleString()}`
                : 'Awaiting a complete source check.'}
            </small>
          </span>,
          document.body,
        )}
    </span>
  );
}
