import type { PointerEvent, ReactNode } from 'react';

function move(event: PointerEvent<HTMLElement>) {
  if (!window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
    return;
  }

  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;

  card.style.setProperty('--card-x', `${x * 100}%`);
  card.style.setProperty('--card-y', `${y * 100}%`);
  card.style.setProperty('--card-rotate-x', `${(0.5 - y) * 3}deg`);
  card.style.setProperty('--card-rotate-y', `${(x - 0.5) * 3}deg`);
}

export function PlanCard({ children, pro = false }: { children: ReactNode; pro?: boolean }) {
  return (
    <section
      className={`pricing-card${pro ? ' pricing-card-pro' : ''}`}
      onPointerMove={move}
      onPointerLeave={(event) => {
        event.currentTarget.style.setProperty('--card-rotate-x', '0deg');
        event.currentTarget.style.setProperty('--card-rotate-y', '0deg');
      }}
    >
      <div className="pricing-card-content">{children}</div>
    </section>
  );
}
