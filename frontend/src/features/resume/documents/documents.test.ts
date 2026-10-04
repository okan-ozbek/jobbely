import { describe, expect, it } from 'vitest';
import { strToU8 } from 'fflate';
import { extractDocx } from './docx.js';
import { extractPdf, pdfReadingLines } from './pdf.js';
import { checkDocument, documentLimits } from './model.js';
import { paragraph, syntheticDocx, syntheticPdf } from './fixtures.js';

describe('bounded local DOCX adapter', () => {
  it('preserves headings, paragraphs, table rows and headers in reading order', () => {
    const bytes = syntheticDocx(
      paragraph('Experience') +
        paragraph('Engineer | Fictional Labs') +
        '<w:tbl><w:tr><w:tc>' +
        paragraph('TypeScript') +
        '</w:tc><w:tc>' +
        paragraph('PostgreSQL') +
        '</w:tc></w:tr></w:tbl>',
      {
        'word/header1.xml': strToU8(
          `<w:hdr xmlns:w="w">${paragraph('Synthetic Candidate')}</w:hdr>`,
        ),
      },
    );

    const result = extractDocx(bytes);

    expect(result.text).toBe(
      'Synthetic Candidate\n\nExperience\n\nEngineer | Fictional Labs\n\nTypeScript | PostgreSQL',
    );

    expect(result.blocks.map((block) => block.kind)).toEqual([
      'header',
      'paragraph',
      'paragraph',
      'table-row',
    ]);
  });

  it('rejects malformed, oversized, traversal, embedded and external-reference archives', () => {
    const files = [
      new Uint8Array([80, 75, 3, 4, 0]),
      syntheticDocx(paragraph('Synthetic'), { '../outside': strToU8('bad') }),
      syntheticDocx(paragraph('Synthetic'), { 'word/vbaProject.bin': strToU8('bad') }),
      syntheticDocx(paragraph('Synthetic'), {
        'word/_rels/document.xml.rels': strToU8(
          '<Relationships><Relationship TargetMode="External" Target="file:///private"/></Relationships>',
        ),
      }),
      syntheticDocx(paragraph('Synthetic'), {
        'word/_rels/document.xml.rels': strToU8(
          '<Relationships><Relationship TargetMode="Ex&#116;ernal" Target="https://example.invalid/private"/></Relationships>',
        ),
      }),
      syntheticDocx(paragraph('Synthetic'), {
        'word/document2.xml': strToU8('x'.repeat(documentLimits.entryBytes + 1)),
      }),
    ];

    for (const bytes of files) {
      expect(() => extractDocx(bytes)).toThrow();
    }

    expect(() => checkDocument(new Uint8Array(documentLimits.bytes + 1), 'docx')).toThrow('5 MiB');
  });

  it('rejects invalid XML and entity declarations without resolving references', () => {
    expect(() => extractDocx(syntheticDocx('<w:p>broken'))).toThrow('malformed');

    expect(() =>
      extractDocx(
        syntheticDocx(
          '<!DOCTYPE w [<!ENTITY leak SYSTEM "file:///secret">]>' + paragraph('&leak;'),
        ),
      ),
    ).toThrow();
  });

  it('checks CRC and inflated sizes instead of trusting ZIP directory declarations', () => {
    const bytes = syntheticDocx(paragraph('Synthetic'));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const end = bytes.length - 22;
    const central = view.getUint32(end + 16, true);

    view.setUint32(central + 16, view.getUint32(central + 16, true) ^ 1, true);
    expect(() => extractDocx(bytes)).toThrow('checksum');
  });

  it('enforces output and entry-count bounds', () => {
    expect(() => extractDocx(syntheticDocx(paragraph('x'.repeat(2_001))))).toThrow('limits');

    const extra = Object.fromEntries(
      Array.from({ length: 1_001 }, (_, index) => [`word/extra${index}`, strToU8('x')]),
    );

    expect(() => extractDocx(syntheticDocx(paragraph('Synthetic'), extra))).toThrow('limits');
  });
});

describe('bounded PDF adapter', () => {
  it('keeps aligned company/title headers and right-hand dates together across pages', async () => {
    const document = await extractPdf(
      syntheticPdf([
        [
          { text: 'Professional Experience', x: 40, y: 750 },
          { text: 'Orion Media - Software Engineer', x: 40, y: 710 },
          { text: 'Jan 2024 - Present', x: 440, y: 710 },
          { text: 'Built services using TypeScript.', x: 40, y: 680 },
        ],
        [
          { text: 'Pine Studio - Senior Software Engineer', x: 40, y: 750 },
          { text: 'Jan 2020 - Dec 2023', x: 440, y: 750 },
          { text: 'Built asynchronous systems.', x: 40, y: 720 },
        ],
      ]),
    );

    expect(document.text).toContain('Orion Media - Software Engineer Jan 2024 - Present');
    expect(document.text).toContain('Pine Studio - Senior Software Engineer Jan 2020 - Dec 2023');
    expect(document.blocks.at(-1)!.page).toBe(2);
  });

  it('reads a single-column PDF and matches equivalent DOCX text', async () => {
    const lines = [
      'Synthetic Candidate',
      'Experience',
      'Engineer | Fictional Labs',
      'Jan 2020 - Dec 2023',
      'Built TypeScript services.',
    ];

    const pdf = await extractPdf(
      syntheticPdf([lines.map((text, index) => ({ text, x: 40, y: 750 - index * 30 }))]),
    );

    const docx = extractDocx(syntheticDocx(lines.map(paragraph).join('')));

    expect(pdf.text.replace(/\n+/g, '\n')).toBe(docx.text.replace(/\n+/g, '\n'));
    expect(pdf.blocks.map((block) => block.page)).toEqual([1, 1, 1, 1, 1]);
  });

  it('reads two columns independently and preserves a spanning header', () => {
    const words = [
      { text: 'Synthetic heading across two columns', x: 30, y: 790, width: 500, height: 12 },
      ...Array.from({ length: 4 }, (_, index) => [
        { text: `Left ${index}`, x: 30, y: 740 - index * 30, width: 100, height: 12 },
        { text: `Right ${index}`, x: 350, y: 740 - index * 30, width: 100, height: 12 },
      ]).flat(),
    ];

    expect(pdfReadingLines(words, 600)).toEqual({
      twoColumns: true,
      lines: [
        'Synthetic heading across two columns',
        'Left 0',
        'Left 1',
        'Left 2',
        'Left 3',
        '',
        'Right 0',
        'Right 1',
        'Right 2',
        'Right 3',
      ],
    });
  });

  it('rejects image-only, damaged, oversized and too-many-page documents', async () => {
    await expect(extractPdf(syntheticPdf([[]]))).rejects.toThrow('No readable text');
    await expect(extractPdf(strToU8('%PDF-invalid'))).rejects.toThrow('Could not read');

    await expect(extractPdf(syntheticPdf(Array.from({ length: 21 }, () => [])))).rejects.toThrow(
      '20 pages',
    );

    await expect(extractPdf(new Uint8Array(documentLimits.bytes + 1))).rejects.toThrow('5 MiB');
  });

  it('keeps fragmented words visible instead of inventing missing characters', () => {
    expect(
      pdfReadingLines(
        [
          { text: 'Type', x: 0, y: 10, width: 20, height: 12 },
          { text: 'Script', x: 25, y: 10, width: 25, height: 12 },
        ],
        600,
      ).lines,
    ).toEqual(['Type Script']);
  });

  it('rejects password-encrypted PDFs without prompting for or retaining a password', async () => {
    await expect(
      extractPdf(syntheticPdf([[{ text: 'Synthetic', x: 40, y: 750 }]], true)),
    ).rejects.toThrow('Encrypted PDFs');
  });
});
