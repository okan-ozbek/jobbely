import { useEffect, useMemo, useState } from 'react';
import { transitionPage } from '../components/motion.js';

export function useLocationQuery() {
  const [search, setSearch] = useState(window.location.search);

  useEffect(() => {
    const onPop = () => transitionPage(() => setSearch(window.location.search));

    window.addEventListener('popstate', onPop);

    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const params = useMemo(() => new URLSearchParams(search), [search]);

  const update = (changes: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(window.location.search);

    for (const [key, value] of Object.entries(changes)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }

    const url = `${window.location.pathname}${next.size ? `?${next}` : ''}`;

    const commit = () => {
      window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
      setSearch(window.location.search);
    };

    if (!replace && ('view' in changes || 'job' in changes)) {
      transitionPage(commit);
    } else {
      commit();
    }
  };

  return { params, update };
}
