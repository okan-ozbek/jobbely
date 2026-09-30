import { useEffect, useMemo, useState } from "react";

export function useLocationQuery() {
  const [search, setSearch] = useState(window.location.search);
  useEffect(() => {
    const onPop = () => setSearch(window.location.search);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const update = (changes: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const url = `${window.location.pathname}${next.size ? `?${next}` : ""}`;
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
    setSearch(window.location.search);
  };
  return { params, update };
}
