import { DocumentError, documentLimits } from './model.js';
import type { ExtractedDocument } from './model.js';

interface DocumentReply {
  result?: ExtractedDocument;
  error?: string;
}

export interface DocumentWorker {
  onmessage: ((event: MessageEvent<DocumentReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(
    value: { format: 'pdf' | 'docx'; bytes: ArrayBuffer },
    transfer: Transferable[],
  ): void;
  terminate(): void;
}

export function workerIsolationPolicy(csp: string, development: boolean) {
  const directives = new Map(
    csp.split(';').map((directive) => {
      const [name, ...values] = directive.trim().split(/\s+/);

      return [name, values.join(' ')];
    }),
  );

  return (
    directives.get('default-src') === "'none'" &&
    directives.get('connect-src') === "'none'" &&
    directives.get('script-src') === (development ? "'self'" : "'none'") &&
    directives.get('worker-src') === "'none'"
  );
}

export async function readLocalDocument(
  file: Pick<File, 'size' | 'arrayBuffer'>,
  format: 'pdf' | 'docx',
  signal: AbortSignal,
  capabilities: {
    verify: (signal: AbortSignal) => Promise<void>;
    createWorker: () => DocumentWorker;
    timeoutMs?: number;
  },
) {
  if (!file.size || file.size > documentLimits.bytes) {
    throw new DocumentError('Choose a nonempty PDF or DOCX no larger than 5 MiB.');
  }

  const controller = new AbortController();
  let worker: DocumentWorker | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  let abort: () => void = () => {};

  try {
    return await new Promise<ExtractedDocument>((resolve, reject) => {
      abort = () => {
        controller.abort();
        reject(new DOMException('Document reading cancelled', 'AbortError'));
      };

      signal.addEventListener('abort', abort, { once: true });

      if (signal.aborted) {
        abort();

        return;
      }

      timer = setTimeout(() => {
        controller.abort();

        reject(
          new DocumentError(
            'Document reading exceeded 30 seconds. Try a shorter file or paste text.',
          ),
        );
      }, capabilities.timeoutMs ?? documentLimits.timeoutMs);

      void (async () => {
        await capabilities.verify(controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        const bytes = await file.arrayBuffer();

        if (controller.signal.aborted) {
          return;
        }

        worker = capabilities.createWorker();

        worker.onmessage = (event) => {
          if (controller.signal.aborted) {
            return;
          }

          // PDF.js emits a worker readiness message before our document result.
          if (!event.data || (!('result' in event.data) && !('error' in event.data))) {
            return;
          }

          if (event.data.result) {
            resolve(event.data.result);
          } else {
            reject(new DocumentError(event.data.error ?? 'Could not read this document.'));
          }
        };

        worker.onerror = () =>
          reject(new DocumentError('Document worker could not run. Paste text instead.'));

        worker.postMessage({ format, bytes }, [bytes]);
      })().catch(() =>
        reject(
          new DocumentError(
            'Document isolation could not be verified, or the file could not be opened. Paste text instead.',
          ),
        ),
      );
    });
  } finally {
    controller.abort();
    signal.removeEventListener('abort', abort);

    if (timer) {
      clearTimeout(timer);
    }

    // Assigned by the async setup above before a message can resolve the promise.
    const activeWorker = worker as DocumentWorker | null;

    activeWorker?.terminate();
  }
}
