import type { PointerEvent } from 'react';

/** Subtle pointer feedback, shared by glass surfaces. No idle or touch animation. */
export function moveSurface(event: PointerEvent<HTMLElement>) {
  if (!window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
    return;
  }

  const surface = event.currentTarget;
  const bounds = surface.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
  const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));

  surface.style.setProperty('--card-x', `${x * 100}%`);
  surface.style.setProperty('--card-y', `${y * 100}%`);
  surface.style.setProperty('--card-rotate-x', `${(0.5 - y) * 3}deg`);
  surface.style.setProperty('--card-rotate-y', `${(x - 0.5) * 3}deg`);
}

export function resetSurface(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty('--card-rotate-x', '0deg');
  event.currentTarget.style.setProperty('--card-rotate-y', '0deg');
}
