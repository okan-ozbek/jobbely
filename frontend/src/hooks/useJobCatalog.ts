import { useEffect, useRef, useState } from 'react';
import { ApiError, listCategories, listCompanies, listJobs, listFacets } from '../api/client.js';
import type { Company, Job, JobsQuery } from '../api/client.js';

export function useJobCatalog(query: JobsQuery, view: 'jobs' | 'companies' | 'detail' | 'none') {
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
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const [retry, setRetry] = useState(0);
  const [settled, setSettled] = useState<{ query: JobsQuery; retry: number } | null>(null);
  const sequence = useRef(0);
  const pageRequest = useRef<AbortController | null>(null);
  const fetchJobs = view === 'jobs';
  const fetchMetadata = view !== 'none';
  const refreshCoverage = view === 'companies';
  // Hide old rows on the very first render of a new query, before effects run.
  const current = settled?.query === query && settled.retry === retry;

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++sequence.current;

    pageRequest.current?.abort();

    if (!fetchJobs) {
      setLoading(false);

      return () => controller.abort();
    }

    setLoading(true);
    setError(null);
    setLoadingMore(false);
    setJobs([]);
    setTotal(0);
    setNextCursor(null);

    const countryQuery = { ...query };

    delete countryQuery.country;
    delete countryQuery.city;
    delete countryQuery.cursor;

    const cityQuery = { ...query };

    delete cityQuery.city;
    delete cityQuery.cursor;

    const timeout = window.setTimeout(() => {
      void listJobs(query, controller.signal)
        .then((list) => {
          if (controller.signal.aborted || requestId !== sequence.current) {
            return;
          }

          setJobs(list.items);
          setTotal(list.total);
          setNextCursor(list.nextCursor);
          setMode(list.mode);
        })
        .catch((reason) => {
          if (!controller.signal.aborted && requestId === sequence.current) {
            setError(reason instanceof Error ? reason.message : 'Could not connect to Jobbely.');
          }
        })
        .finally(() => {
          if (requestId === sequence.current && !controller.signal.aborted) {
            setSettled({ query, retry });
            setLoading(false);
          }
        });

      const countryFacets = listFacets(countryQuery, controller.signal);

      const cityFacets =
        JSON.stringify(countryQuery) === JSON.stringify(cityQuery)
          ? countryFacets
          : listFacets(cityQuery, controller.signal);

      void Promise.all([countryFacets, cityFacets])
        .then(([countries, cities]) => {
          if (!controller.signal.aborted && requestId === sequence.current) {
            setLocations({ countries: countries.countries, cities: cities.cities });
          }
        })
        .catch(() => {
          // Results remain usable while facet metadata is temporarily unavailable.
        });
    }, 200);

    return () => {
      controller.abort();
      pageRequest.current?.abort();
      window.clearTimeout(timeout);
    };
  }, [query, retry, fetchJobs]);

  useEffect(() => {
    if (!fetchMetadata) {
      return;
    }

    const controller = new AbortController();

    setMetadataLoading(true);
    setMetadataError(null);

    void Promise.all([listCompanies(controller.signal), listCategories(controller.signal)])
      .then(([companyList, categoryList]) => {
        if (!controller.signal.aborted) {
          setCompanies(companyList);
          setCategories(categoryList);

          if (refreshCoverage) {
            setMode(companyList.some((company) => company.status === 'demo') ? 'demo' : 'postgres');
          }
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setMetadataError(reason instanceof Error ? reason.message : 'Could not load companies.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setMetadataLoading(false);
        }
      });

    return () => controller.abort();
  }, [fetchMetadata, refreshCoverage, retry]);

  useEffect(() => {
    if (!refreshCoverage) {
      return;
    }

    let controller: AbortController | undefined;

    const updateCoverage = () => {
      if (document.hidden) {
        return;
      }

      controller?.abort();
      controller = new AbortController();

      const signal = controller.signal;

      void listCompanies(signal)
        .then((next) => {
          if (!signal.aborted) {
            setCompanies(next);
          }
        })
        .catch(() => {
          // Keep the directory usable during a temporary background refresh failure.
        });
    };

    const timer = window.setInterval(updateCoverage, 60_000);

    document.addEventListener('visibilitychange', updateCoverage);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updateCoverage);
      controller?.abort();
    };
  }, [refreshCoverage]);

  const loadMore = async () => {
    if (!fetchJobs || !current || !nextCursor || loading || loadingMore) {
      return;
    }

    const requestId = sequence.current;
    const controller = new AbortController();

    pageRequest.current?.abort();
    pageRequest.current = controller;

    setLoadingMore(true);

    try {
      const page = await listJobs({ ...query, cursor: nextCursor }, controller.signal);

      if (controller.signal.aborted || requestId !== sequence.current) {
        return;
      }

      setJobs((previous) => [...previous, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      if (controller.signal.aborted || requestId !== sequence.current) {
        return;
      }

      if (reason instanceof ApiError && reason.code === 'cursor_stale') {
        setRetry((value) => value + 1);
      } else {
        setError(reason instanceof Error ? reason.message : 'Could not load more listings.');
      }
    } finally {
      if (!controller.signal.aborted && requestId === sequence.current) {
        setLoadingMore(false);
      }
    }
  };

  return {
    companies,
    categories,
    locations,
    jobs: current ? jobs : [],
    total: current ? total : 0,
    nextCursor: current ? nextCursor : null,
    mode,
    loading: refreshCoverage ? metadataLoading : fetchJobs && (loading || !current),
    loadingMore: current && loadingMore,
    error: metadataError ?? (fetchJobs && current ? error : null),
    loadMore,
    refresh: () => setRetry((value) => value + 1),
  };
}
