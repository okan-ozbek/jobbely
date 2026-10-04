import type { JobDocument } from '../domain/matching/document.js';

export interface JobDocumentReader {
  read(input: { descriptionText: string; descriptionHtml?: string }): JobDocument;
}
