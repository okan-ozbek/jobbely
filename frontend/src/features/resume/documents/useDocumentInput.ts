import { useEffect, useRef, useState } from 'react';
import type { ExtractedDocument } from './model.js';
import { readLocalDocument, workerIsolationPolicy } from './reader.js';
import workerUrl from './document.worker.ts?worker&url';

export function useDocumentInput(receiveText: (text: string) => void) {
  const [document, setDocument] = useState<ExtractedDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);

  const cancel = () => {
    active.current?.abort();
    setLoading(false);
  };

  const clear = () => {
    cancel();
    setDocument(null);
    setError('');
  };

  useEffect(() => () => active.current?.abort(), []);

  const select = async (file: File) => {
    clear();

    const format = file.name.toLowerCase().endsWith('.pdf')
      ? 'pdf'
      : file.name.toLowerCase().endsWith('.docx')
        ? 'docx'
        : null;

    if (!format) {
      setError('Choose a PDF or DOCX file.');

      return;
    }

    const controller = new AbortController();

    active.current = controller;
    receiveText('');
    setLoading(true);

    try {
      const result = await readLocalDocument(file, format, controller.signal, {
        createWorker: () => new Worker(workerUrl, { type: 'module' }),
        verify: async (signal) => {
          const response = await fetch(workerUrl, {
            method: 'HEAD',
            cache: 'no-store',
            credentials: 'omit',
            signal,
          });

          if (
            !response.ok ||
            !workerIsolationPolicy(
              response.headers.get('Content-Security-Policy') ?? '',
              import.meta.env.DEV,
            )
          ) {
            throw new Error('isolation unavailable');
          }
        },
      });

      if (!controller.signal.aborted) {
        setDocument(result);
        receiveText(result.text);
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : 'Could not read this document.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  return { document, loading, error, select, cancel, clear };
}
