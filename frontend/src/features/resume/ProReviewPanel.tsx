import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { ResumeReviewInfo } from './ResumeReviewInfo.js';
import './pro-review.css';

export function ProReviewPanel({
  id,
  title,
  className,
  limitations,
  infoTitle,
  actions,
  children,
  module,
}: {
  id: string;
  title: string;
  className: string;
  limitations: readonly string[];
  infoTitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  module: 'resume' | 'role';
}) {
  const Heading = module === 'role' ? 'h3' : 'h2';

  return (
    <section
      className={`pro-review-panel ${className}`}
      aria-labelledby={id}
      data-review-module={module}
    >
      <div className="pro-review-heading">
        <div className="pro-review-title">
          <span
            className="pro-review-emblem"
            aria-hidden="true"
          >
            <Sparkles size={22} />
          </span>
          <Heading id={id}>{title}</Heading>
          <ResumeReviewInfo
            limitations={limitations}
            title={infoTitle}
          />
        </div>
        <div className="pro-review-heading-actions">
          <span className="pro-review-badge">Pro</span>
          {actions}
        </div>
      </div>
      {children}
    </section>
  );
}
