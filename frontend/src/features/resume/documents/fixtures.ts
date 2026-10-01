import { zipSync, strToU8 } from 'fflate';

export function syntheticDocx(body: string, extra: Record<string, Uint8Array> = {}) {
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    'word/document.xml': strToU8(
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
    ),
    ...extra,
  });
}

export function paragraph(text: string) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

export function syntheticPdf(pages: { text: string; x: number; y: number }[][], encrypted = false) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  for (const [index, lines] of pages.entries()) {
    const stream = lines
      .map(
        (line) =>
          `BT /F1 12 Tf ${line.x} ${line.y} Td (${line.text.replace(/[\\()]/g, '\\$&')}) Tj ET`,
      )
      .join('\n');

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  }

  if (encrypted) {
    objects.push(
      `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${'00'.repeat(32)}> /U <${'00'.repeat(32)}> /P -4 >>`,
    );
  }

  let output = '%PDF-1.7\n';
  const offsets = [0];

  for (const [index, object] of objects.entries()) {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xref = output.length;

  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)
    .join(
      '\n',
    )}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${encrypted ? `/Encrypt ${objects.length} 0 R /ID [<${'00'.repeat(16)}> <${'00'.repeat(16)}>]` : ''} >>\nstartxref\n${xref}\n%%EOF`;

  return strToU8(output);
}
