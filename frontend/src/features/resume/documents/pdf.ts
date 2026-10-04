import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import { checkDocument, DocumentError, documentLimits, finishDocument } from './model.js';
import type { ReadingBlock } from './model.js';

export interface PdfWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function pdfReadingLines(words: PdfWord[], width: number) {
  const rows: PdfWord[][] = [];

  for (const word of [...words].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find(
      (item) =>
        Math.abs(item[0]!.y - word.y) <= Math.max(2, Math.min(item[0]!.height, word.height) * 0.35),
    );

    if (row) {
      row.push(word);
    } else {
      rows.push([word]);
    }
  }

  const middle = width / 2;

  const splitRows = rows.filter(
    (row) =>
      row.some((word) => word.x + word.width < middle - 10) &&
      row.some((word) => word.x > middle + 10) &&
      !row.some((word) => word.x <= middle && word.x + word.width >= middle),
  );

  const twoColumns = splitRows.length >= 3 && splitRows.length / Math.max(1, rows.length) > 0.3;

  const join = (row: PdfWord[]) =>
    [...row]
      .sort((a, b) => a.x - b.x)
      .map((word) => word.text)
      .join(' ')
      .replace(/[\t ]+/g, ' ')
      .trim();

  if (!twoColumns) {
    return { lines: rows.map(join), twoColumns };
  }

  // Spanning rows separate bands; each band's left column precedes its right column.
  const lines: string[] = [];
  let band: PdfWord[][] = [];

  const flush = () => {
    for (const right of [false, true]) {
      if (
        right &&
        band.some((row) => row.some((word) => word.x > middle)) &&
        band.some((row) => row.some((word) => word.x <= middle))
      ) {
        lines.push('');
      }

      lines.push(
        ...band
          .map((row) => join(row.filter((word) => (right ? word.x > middle : word.x <= middle))))
          .filter(Boolean),
      );
    }

    band = [];
  };

  for (const row of rows) {
    if (row.some((word) => word.x < middle && word.x + word.width > middle)) {
      flush();
      lines.push(join(row));
    } else {
      band.push(row);
    }
  }

  flush();

  return { lines, twoColumns };
}

export async function extractPdf(bytes: Uint8Array) {
  checkDocument(bytes, 'pdf');

  const task = getDocument({
    data: bytes,
    enableXfa: false,
    disableFontFace: true,
    useSystemFonts: false,
    useWasm: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    maxImageSize: 0,
    stopAtErrors: true,
    verbosity: 0,
  });

  const blocks: ReadingBlock[] = [];
  const warnings: string[] = [];

  try {
    const document = await task.promise;

    if (document.numPages > documentLimits.pages) {
      throw new DocumentError('PDF exceeds 20 pages. Use a shorter document.');
    }

    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();

      if (content.items.length > 10_000) {
        throw new DocumentError('PDF page complexity exceeds the limit.');
      }

      const words: PdfWord[] = content.items.flatMap((item) =>
        'str' in item && item.str.trim()
          ? [
              {
                text: item.str,
                x: item.transform[4] as number,
                y: item.transform[5] as number,
                width: item.width,
                height: item.height,
              },
            ]
          : [],
      );

      const reading = pdfReadingLines(words, page.getViewport({ scale: 1 }).width);

      if (reading.twoColumns) {
        warnings.push(
          `Page ${number}: two-column order inferred. Check the preview before analysis.`,
        );
      }

      if (!reading.lines.length) {
        warnings.push(`Page ${number}: no text layer found. Images were not OCR'd.`);
      }

      if (number > 1) {
        blocks.push({ order: blocks.length + 1, page: number, kind: 'paragraph', text: '' });
      }

      for (const line of reading.lines) {
        blocks.push({ order: blocks.length + 1, page: number, kind: 'paragraph', text: line });
      }

      if (
        blocks.length > documentLimits.blocks ||
        blocks.reduce((total, block) => total + block.text.length, 0) > documentLimits.characters
      ) {
        throw new DocumentError('PDF extracted text exceeds the limit.');
      }

      page.cleanup();
    }

    return finishDocument('pdf', blocks, [
      ...warnings,
      'Reading order is inferred from text positions. Inspect broken words, columns and headers; this does not reproduce a particular ATS.',
    ]);
  } catch (error) {
    if (error instanceof DocumentError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'PasswordException') {
      throw new DocumentError(
        'Encrypted PDFs are not supported. Export an unencrypted copy or paste text.',
      );
    }

    throw new DocumentError(
      'Could not read this PDF. It may be damaged or unsupported; paste text instead.',
    );
  } finally {
    await task.destroy();
  }
}
