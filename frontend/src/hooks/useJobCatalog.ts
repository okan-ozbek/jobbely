import { useEffect, useRef, useState } from 'react';
import { ApiError, listCategories, listCompanies, listJobs, listFacets } from '../api/client.js';
import type { Company, Job, JobsQuery } from '../api/client.js';

export function useJobCatalog(query: JobsQuery) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);

  const [locations, setLocations] = useState<{
    countries: { value: string; name: string; count: number }[];
    cities: { value: string; count: number }[];
  }>({ countries: [], cities: [] });

  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [mode, setMode] = useState<'demo' | 'postgres' | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [retry, setRetry] = useState(0);
  const sequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++sequence.current;

    setLoading(true);
    setError(null);
    setLoadingMore(false);

    const countryQuery = { ...query };

    delete countryQuery.country;
    delete countryQuery.city;
    delete countryQuery.cursor;

    const cityQuery = { ...query };

    delete cityQuery.city;
    delete cityQuery.cursor;

    const timeout = window.setTimeout(() => {
      void Promise.all([
        listJobs(query, controller.signal),
        listCompanies(controller.signal),
        listCategories(controller.signal),
        listFacets(countryQuery, controller.signal),
        listFacets(cityQuery, controller.signal),
      ])
        .then(([list, companyList, categoryList, countryFacets, cityFacets]) => {
          if (requestId !== sequence.current) {
            return;
          }

          setJobs(list.items);
          setTotal(list.total);
          setNextCursor(list.nextCursor);
          setMode(list.mode);

          setCompanies(companyList);
          setCategories(categoryList);
          setLocations({ countries: countryFacets.countries, cities: cityFacets.cities });
        })
        .catch((reason) => {
          if (!controller.signal.aborted && requestId === sequence.current) {
            setError(reason instanceof Error ? reason.message : 'Could not connect to Jobbely.');
          }
        })
        .finally(() => {
          if (requestId === sequence.current && !controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, retry]);

  const loadMore = async () => {
    if (!nextCursor || loading || loadingMore) {
      return;
    }

    const requestId = sequence.current;

    setLoadingMore(true);

    try {
      const page = await listJobs({ ...query, cursor: nextCursor });

      if (requestId !== sequence.current) {
        return;
      }

      setJobs((previous) => [...previous, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      if (requestId !== sequence.current) {
        return;
      }

      if (reason instanceof ApiError && reason.code === 'cursor_stale') {
        setRetry((value) => value + 1);
      } else {
        setError(reason instanceof Error ? reason.message : 'Could not load more listings.');
      }
    } finally {
      if (requestId === sequence.current) {
        setLoadingMore(false);
      }
    }
  };

  return {
    companies,
    categories,
    locations,
    jobs,
    total,
    nextCursor,
    mode,
    loading,
    loadingMore,
    error,
    loadMore,
    refresh: () => setRetry((value) => value + 1),
  };
}
