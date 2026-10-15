import { ClipboardCheck, Sparkles } from 'lucide-react';
import { moveSurface, resetSurface } from '../../components/surface-motion.js';
import './review-progress.css';

export function ReviewProgress({
  title,
  description,
  ai = true,
}: {
  title: string;
  description: string;
  ai?: boolean;
}) {
  return (
    <div
      className="review-progress"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onPointerMove={moveSurface}
      onPointerLeave={resetSurface}
    >
      <div
        className="review-progress-visual"
        aria-hidden="true"
      >
        <span className="review-progress-halo" />
        <span className="review-progress-orbit">
          <i />
          <i />
        </span>
        <span className="review-progress-symbol">
          {ai ? <Sparkles size={26} /> : <ClipboardCheck size={26} />}
        </span>
      </div>
      <div className="review-progress-copy">
        <strong>{title}</strong>
        <p>{description}</p>
        <div
          className="review-progress-track"
          aria-hidden="true"
        >
          <span />
        </div>
      </div>
    </div>
  );
}
