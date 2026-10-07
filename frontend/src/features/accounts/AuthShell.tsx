import { ArrowUpRight, Compass, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import './auth.css';

export function AuthShell({
  signedIn,
  onClose,
  children,
}: {
  signedIn: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (signedIn) {
    return <>{children}</>;
  }

  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <div className="auth-story-top">
          <span className="auth-wordmark">
            jobbely<span>.</span>
          </span>
          <button onClick={onClose}>
            Back to website <ArrowUpRight size={15} />
          </button>
        </div>
        <div
          className="auth-landscape"
          aria-hidden="true"
        >
          <div className="auth-orbit" />
          <div className="auth-horizon auth-horizon-far" />
          <div className="auth-horizon auth-horizon-near" />
          <span className="auth-star">
            <Sparkles size={34} />
          </span>
        </div>
        <div className="auth-story-copy">
          <span className="auth-story-kicker">
            <Compass size={16} /> A little clarity. A new chapter.
          </span>
          <h2>
            Your next role.
            <br />
            <span>Starts with you.</span>
          </h2>
          <p>
            A place to explore your possibilities.
            <br />
            And find a little more direction.
          </p>
          <span
            className="auth-story-line"
            aria-hidden="true"
          />
        </div>
      </aside>
      <div className="auth-content">{children}</div>
    </div>
  );
}
