import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function Disclosure({ summary, children, className = '' }: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className={`disclosure ${className}`} data-open={open}>
      <button type="button" className="disclosure-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span>{summary}</span><ChevronDown size={17} aria-hidden="true" />
      </button>
      <div className="disclosure-grid" aria-hidden={!open} inert={!open} id={id}>
        <div className="disclosure-inner">{children}</div>
      </div>
    </div>
  );
}
