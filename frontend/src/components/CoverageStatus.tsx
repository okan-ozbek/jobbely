import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, CircleHelp, Clock3, FlaskConical, Info } from 'lucide-react';
import type { Company } from '../api/client.js';

const coverage = {
  not_onboarded: { label: 'Not connected', explanation: 'This company has no connected source. Its listing count does not establish employer coverage.', icon: CircleHelp },
  partial: { label: 'Partial coverage', explanation: 'A source is connected, but complete employer coverage has not been verified.', icon: Info },
  stale: { label: 'Refresh overdue', explanation: 'The latest complete source check is over 36 hours old. Stored listings may have changed.', icon: Clock3 },
  blocked: { label: 'Refresh failed', explanation: 'The latest source refresh failed. Stored listings do not establish current availability or complete coverage.', icon: AlertCircle },
  healthy: { label: 'Full coverage', explanation: 'Connected sources have verified scope and a successful complete refresh under the current source checks.', icon: CheckCircle2 },
  demo: { label: 'Sample source', explanation: 'These listings are synthetic examples, not active vacancies.', icon: FlaskConical },
};

export function CoverageStatus({ company }: { company: Company }) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const item = coverage[company.status];
  const Icon = item.icon;

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) { setOpen(false); }
    };
    window.addEventListener('pointerdown', dismiss);
    return () => window.removeEventListener('pointerdown', dismiss);
  }, []);

  return <span ref={root} className={`coverage-status coverage-${company.status}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button type="button" aria-label={`${company.name}: ${item.label}`} aria-describedby={open ? id : undefined} aria-expanded={open} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)} onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); } }}><Icon size={15} /></button>
    {open && <span role="tooltip" id={id} className="coverage-context"><strong>{item.label}</strong><span>{item.explanation}</span><small>{company.lastCheckedAt ? `Last complete check: ${new Date(company.lastCheckedAt).toLocaleString()}` : 'Awaiting a complete source check.'}</small></span>}
  </span>;
}
