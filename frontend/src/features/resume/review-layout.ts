import type { ExtractedDocument } from './documents/model.js';
import type { ResumeReviewInput } from '../../api/resume-review.js';

export function reviewLayout(document: ExtractedDocument | null): ResumeReviewInput['layout'] {
  if (!document) {
    return undefined;
  }

  return {
    format: document.format,
    pages: document.layout?.pages ?? null,
    columnPages: document.layout?.columnPages ?? [],
    smallTextPages: document.layout?.smallTextPages ?? [],
    tableRows: document.blocks.filter((block) => block.kind === 'table-row').length,
    contactInHeaderFooter: document.blocks.some(
      (block) =>
        (block.kind === 'header' || block.kind === 'footer') &&
        (/@/.test(block.text) || /\+?\d[\d ()-]{7,}\d/.test(block.text)),
    ),
  };
}
