import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

export function ResumeReviewInfo({ limitations }: { limitations: readonly string[] }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const context = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const cancelHide = () => {
    if (hideTimer.current !== null) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const show = () => {
    cancelHide();
    setRect(trigger.current!.getBoundingClientRect());
  };

  const hideSoon = () => {
    cancelHide();

    hideTimer.current = setTimeout(() => {
      if (!context.current?.matches(':hover')) {
        setRect(null);
      }
    }, 150);
  };

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !trigger.current?.contains(event.target) &&
        !context.current?.contains(event.target)
      ) {
        setRect(null);
      }
    };

    const hide = () => setRect(null);

    const hideOnScroll = (event: Event) => {
      if (event.target instanceof Node && context.current?.contains(event.target)) {
        return;
      }

      hide();
    };

    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRect(null);
      }
    };

    window.addEventListener('pointerdown', dismiss);
    window.addEventListener('scroll', hideOnScroll, true);
    window.addEventListener('resize', hide);
    window.addEventListener('keydown', escape);

    return () => {
      if (hideTimer.current !== null) {
        clearTimeout(hideTimer.current);
      }

      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('scroll', hideOnScroll, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('keydown', escape);
    };
  }, []);

  const width = Math.min(360, window.innerWidth - 32);
  const below = !!rect && window.innerHeight - rect.bottom >= Math.min(280, rect.top);

  return (
    <>
      <button
        ref={trigger}
        className="reviewer-info-button"
        type="button"
        aria-label="What this review can assess"
        aria-describedby={rect ? id : undefined}
        aria-expanded={!!rect}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={hideSoon}
        onClick={show}
      >
        <Info
          size={16}
          aria-hidden="true"
        />
      </button>
      {rect &&
        createPortal(
          <div
            ref={context}
            id={id}
            role="tooltip"
            className="reviewer-context"
            onMouseEnter={cancelHide}
            onMouseLeave={hideSoon}
            style={{
              width,
              left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)),
              maxHeight: Math.max(80, (below ? window.innerHeight - rect.bottom : rect.top) - 24),
              ...(below ? { top: rect.bottom + 8 } : { bottom: window.innerHeight - rect.top + 8 }),
            }}
          >
            <strong>What this review can assess</strong>
            <ul>
              {limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
