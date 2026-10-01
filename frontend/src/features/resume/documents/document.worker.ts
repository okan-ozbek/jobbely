import { extractPdf } from './pdf.js';
import { extractDocx } from './docx.js';
import { DocumentError } from './model.js';

// Bundled parser worker has no DOM or Node/file/environment access. Production CSP denies network.
self.onmessage = async (event: MessageEvent<{ format: 'pdf' | 'docx'; bytes: ArrayBuffer }>) => {
  try {
    const bytes = new Uint8Array(event.data.bytes);
    const result = event.data.format === 'pdf' ? await extractPdf(bytes) : extractDocx(bytes);

    self.postMessage({ result });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof DocumentError
          ? error.message
          : 'Could not read this document. Use a valid PDF/DOCX or paste text.',
    });
  }
};
