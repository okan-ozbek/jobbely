import { describe, expect, it } from 'vitest';
import { strToU8 } from 'fflate';
import { reviewLayout } from './review-layout.js';
import { extractDocx } from './documents/docx.js';
import { extractPdf } from './documents/pdf.js';
import { paragraph, syntheticDocx, syntheticPdf } from './documents/fixtures.js';

describe('reviewer local layout evidence', () => {
  it('flags predominantly small PDF text using extracted heights', async () => {
    const document = await extractPdf(
      syntheticPdf([
        Array.from({ length: 25 }, (_, index) => ({
          text: `Synthetic line ${index}`,
          x: 40,
          y: 750 - index * 20,
          fontSize: 8,
        })),
      ]),
    );

    expect(reviewLayout(document)?.smallTextPages).toEqual([1]);
  });

  it('does not invent layout evidence for pasted text', () => {
    expect(reviewLayout(null)).toBeUndefined();
  });

  it('recognizes DOCX tables and contact information in headers without sending file bytes', () => {
    const document = extractDocx(
      syntheticDocx(
        paragraph('Experience') +
          '<w:tbl><w:tr><w:tc>' +
          paragraph('Engineer') +
          '</w:tc></w:tr></w:tbl>',
        {
          'word/header1.xml': strToU8(
            '<w:hdr xmlns:w="w">' + paragraph('synthetic@example.invalid') + '</w:hdr>',
          ),
        },
      ),
    );

    expect(reviewLayout(document)).toMatchObject({
      format: 'docx',
      pages: null,
      tableRows: 1,
      contactInHeaderFooter: true,
    });

    expect(JSON.stringify(reviewLayout(document))).not.toContain('synthetic@example.invalid');
  });

  it('carries PDF page and column evidence without changing reading order', async () => {
    const document = await extractPdf(
      syntheticPdf([
        Array.from({ length: 5 }, (_, index) => [
          { text: `Left ${index}`, x: 40, y: 750 - index * 30 },
          { text: `Right ${index}`, x: 400, y: 750 - index * 30 },
        ]).flat(),
      ]),
    );

    expect(reviewLayout(document)).toMatchObject({
      pages: 1,
      columnPages: [1],
      smallTextPages: [],
    });

    expect(document.text.indexOf('Left 4')).toBeLessThan(document.text.indexOf('Right 0'));
  });
});
