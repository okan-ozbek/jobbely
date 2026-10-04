import { flushSync } from 'react-dom';

let pageAnimation: Animation | undefined;

export function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function scrollToSection(element: HTMLElement | null) {
  element?.scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'start' });
}

export function transitionPage(commit: () => void) {
  pageAnimation?.cancel();
  flushSync(commit);
  window.scrollTo({ top: 0, behavior: 'instant' });

  const page = document.querySelector('main');

  if (!reducedMotion() && page?.animate) {
    pageAnimation = page.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' },
    );
  }
}
