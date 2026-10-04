import { flushSync } from 'react-dom';

export function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function scrollToSection(element: HTMLElement | null) {
  element?.scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'start' });
}

export function transitionPage(commit: () => void) {
  const update = () => {
    flushSync(commit);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  if (!reducedMotion() && document.startViewTransition) {
    document.startViewTransition(update);
  } else {
    update();
  }
}
