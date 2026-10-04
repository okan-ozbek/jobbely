export const documentLimits = {
  bytes: 5 * 1024 * 1024,
  expandedBytes: 25 * 1024 * 1024,
  entryBytes: 5 * 1024 * 1024,
  entries: 1_000,
  pages: 20,
  characters: 100_000,
  blocks: 2_000,
  timeoutMs: 30_000,
};

export interface ReadingBlock {
  order: number;
  page: number | null;
  kind: 'paragraph' | 'table-row' | 'header' | 'footer';
  text: string;
}

export interface ExtractedDocument {
  format: 'pdf' | 'docx';
  text: string;
  blocks: ReadingBlock[];
  warnings: string[];
}

export class DocumentError extends Error {}

export function checkDocument(bytes: Uint8Array, format: 'pdf' | 'docx') {
  if (!bytes.length || bytes.length > documentLimits.bytes) {
    throw new DocumentError('Choose a nonempty PDF or DOCX no larger than 5 MiB.');
  }

  const signature = format === 'pdf' ? [37, 80, 68, 70, 45] : [80, 75, 3, 4];

  if (!signature.every((value, index) => bytes[index] === value)) {
    throw new DocumentError('The file signature does not match PDF or DOCX.');
  }
}

export function finishDocument(
  format: ExtractedDocument['format'],
  blocks: ReadingBlock[],
  warnings: string[],
): ExtractedDocument {
  const text = blocks.map((block) => block.text).join(format === 'docx' ? '\n\n' : '\n');

  if (
    blocks.length > documentLimits.blocks ||
    text.length > documentLimits.characters ||
    blocks.some((block) => block.text.length > 2_000)
  ) {
    throw new DocumentError(
      'Extracted text exceeds the analysis limits. Use a shorter document or paste selected text.',
    );
  }

  if (!text.trim()) {
    throw new DocumentError(
      'No readable text found. Image-only documents require OCR; paste text instead.',
    );
  }

  return { format, text, blocks, warnings };
}
