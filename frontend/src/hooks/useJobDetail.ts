import { useEffect, useState } from 'react';
import { getJob } from '../api/client.js';
import type { Job } from '../api/client.js';

export function useJobDetail(selectedId: string | null) {
  const [selected, setSelected] = useState<Job | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
    setDetailError(null);

    if (!selectedId) {
      return;
    }

    const controller = new AbortController();

    void getJob(selectedId, controller.signal)
      .then((job) => {
        if (!controller.signal.aborted) {
          setSelected(job);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setDetailError(reason instanceof Error ? reason.message : 'Listing unavailable.');
        }
      });

    return () => controller.abort();
  }, [selectedId]);

  return { selected, detailError };
}
