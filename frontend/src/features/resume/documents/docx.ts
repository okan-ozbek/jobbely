import { Inflate } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { checkDocument, DocumentError, documentLimits, finishDocument } from './model.js';
import type { ReadingBlock } from './model.js';

interface ZipEntry {
  name: string;
  offset: number;
  size: number;
  originalSize: number;
  method: number;
  checksum: number;
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let result = value;

  for (let bit = 0; bit < 8; bit++) {
    result = result & 1 ? 0xedb88320 ^ (result >>> 1) : result >>> 1;
  }

  return result >>> 0;
});

function archiveEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;

  for (
    let position = bytes.length - 22;
    position >= Math.max(0, bytes.length - 65_557);
    position--
  ) {
    if (
      view.getUint32(position, true) === 0x06054b50 &&
      position + 22 + view.getUint16(position + 20, true) === bytes.length
    ) {
      end = position;
      break;
    }
  }

  if (
    end < 0 ||
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    view.getUint16(end + 8, true) !== view.getUint16(end + 10, true)
  ) {
    throw new DocumentError('Malformed, split or ZIP64 DOCX archives are not supported.');
  }

  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  let position = view.getUint32(end + 16, true);
  const centralStart = position;
  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  let total = 0;

  if (count > documentLimits.entries || centralStart + centralSize !== end) {
    throw new DocumentError('DOCX archive exceeds limits or has an invalid directory.');
  }

  for (let index = 0; index < count; index++) {
    if (position + 46 > end || view.getUint32(position, true) !== 0x02014b50) {
      throw new DocumentError('Malformed DOCX archive directory.');
    }

    const flags = view.getUint16(position + 8, true);
    const method = view.getUint16(position + 10, true);
    const size = view.getUint32(position + 20, true);
    const originalSize = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const offset = view.getUint32(position + 42, true);

    const name = new TextDecoder('utf-8', { fatal: true }).decode(
      bytes.subarray(position + 46, position + 46 + nameLength),
    );

    const unixMode = view.getUint32(position + 38, true) >>> 16;

    total += originalSize;

    if (
      names.has(name) ||
      /(^\/|\\|(^|\/)\.\.(\/|$)|:)/.test(name) ||
      (unixMode & 0xf000) === 0xa000 ||
      flags & 1 ||
      ![0, 8].includes(method) ||
      originalSize > documentLimits.entryBytes ||
      total > documentLimits.expandedBytes ||
      offset + 30 > centralStart ||
      /(?:vbaProject|activeX|embeddings|\.exe$|\.dll$|\.js$)/i.test(name)
    ) {
      throw new DocumentError('DOCX contains unsafe entries or exceeds archive limits.');
    }

    if (
      view.getUint32(offset, true) !== 0x04034b50 ||
      view.getUint16(offset + 6, true) !== flags ||
      view.getUint16(offset + 8, true) !== method
    ) {
      throw new DocumentError('DOCX local headers do not match the directory.');
    }

    const localNameLength = view.getUint16(offset + 26, true);
    const start = offset + 30 + localNameLength + view.getUint16(offset + 28, true);

    const localName = new TextDecoder('utf-8', { fatal: true }).decode(
      bytes.subarray(offset + 30, offset + 30 + localNameLength),
    );

    if (
      localName !== name ||
      start + size > centralStart ||
      (!(flags & 8) &&
        (view.getUint32(offset + 18, true) !== size ||
          view.getUint32(offset + 22, true) !== originalSize))
    ) {
      throw new DocumentError('DOCX archive sizes or filenames are inconsistent.');
    }

    names.add(name);

    entries.push({
      name,
      offset: start,
      size,
      originalSize,
      method,
      checksum: view.getUint32(position + 16, true),
    });

    position += 46 + nameLength + extraLength + commentLength;
  }

  if (position !== end || !names.has('[Content_Types].xml') || !names.has('word/document.xml')) {
    throw new DocumentError('This archive is not a valid DOCX document.');
  }

  return entries;
}

function decodeEntry(bytes: Uint8Array, entry: ZipEntry) {
  const input = bytes.subarray(entry.offset, entry.offset + entry.size);
  const chunks: Uint8Array[] = [];
  let size = 0;

  if (entry.method === 0) {
    chunks.push(input);
    size = input.length;
  } else {
    const inflater = new Inflate((chunk) => {
      size += chunk.length;

      if (size > entry.originalSize || size > documentLimits.entryBytes) {
        throw new DocumentError('DOCX expanded data exceeds declared limits.');
      }

      chunks.push(chunk);
    });

    // Small compressed increments prevent a forged stream inflating an entire bomb at once.
    for (let position = 0; position < input.length; position += 1_024) {
      inflater.push(input.subarray(position, position + 1_024), position + 1_024 >= input.length);
    }
  }

  if (size !== entry.originalSize) {
    throw new DocumentError('DOCX expanded size does not match its directory.');
  }

  const output = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  const text = new TextDecoder('utf-8', { fatal: true }).decode(output);
  let checksum = 0xffffffff;

  for (const byte of output) {
    checksum = crcTable[(checksum ^ byte) & 255]! ^ (checksum >>> 8);
  }

  if ((checksum ^ 0xffffffff) >>> 0 !== entry.checksum) {
    throw new DocumentError('DOCX entry checksum is invalid.');
  }

  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) {
    throw new DocumentError('DOCX XML is malformed or contains forbidden entities.');
  }

  return text;
}

type XmlNode = Record<string, unknown>;

function nodes(value: unknown): XmlNode[] {
  return Array.isArray(value)
    ? value.filter((item): item is XmlNode => typeof item === 'object' && item !== null)
    : [];
}

function rejectExternalReferences(value: unknown, depth = 0): void {
  if (depth > 100) {
    throw new DocumentError('DOCX XML nesting exceeds the limit.');
  }

  for (const node of nodes(value)) {
    const attributes = node[':@'];

    if (attributes && typeof attributes === 'object') {
      for (const [key, entry] of Object.entries(attributes)) {
        if (
          (key === '@_TargetMode' && String(entry).toLowerCase() === 'external') ||
          (key === '@_Target' && /^[a-z][a-z0-9+.-]*:/i.test(String(entry)))
        ) {
          throw new DocumentError(
            'DOCX external references are not supported. Remove them or paste text.',
          );
        }
      }
    }

    for (const [key, child] of Object.entries(node)) {
      if (key !== ':@') {
        rejectExternalReferences(child, depth + 1);
      }
    }
  }
}

function plain(value: unknown): string {
  return nodes(value)
    .map((node) =>
      Object.entries(node)
        .map(([key, child]) =>
          key === '#text'
            ? String(child)
            : key.endsWith(':tab')
              ? '\t'
              : key.endsWith(':br')
                ? '\n'
                : key === ':@'
                  ? ''
                  : plain(child),
        )
        .join(''),
    )
    .join('');
}

export function extractDocx(bytes: Uint8Array) {
  checkDocument(bytes, 'docx');

  const entries = archiveEntries(bytes);

  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    processEntities: true,
    trimValues: false,
    parseTagValue: false,
  });

  const blocks: ReadingBlock[] = [];

  for (const entry of entries.filter(
    (item) => item.name.endsWith('.rels') || item.name === '[Content_Types].xml',
  )) {
    const xml = decodeEntry(bytes, entry);

    rejectExternalReferences(parser.parse(xml));

    if (
      /TargetMode\s*=\s*["']External["']/i.test(xml) ||
      /(?:macroEnabled|vbaProject|altChunk)/i.test(xml)
    ) {
      throw new DocumentError(
        'DOCX external references, macros and embedded documents are not supported. Remove them or paste text.',
      );
    }
  }

  const parts = entries
    .filter((entry) =>
      /^(?:word\/document\.xml|word\/header\d+\.xml|word\/footer\d+\.xml)$/.test(entry.name),
    )
    .sort(
      (a, b) =>
        (a.name.includes('header') ? 0 : a.name.includes('footer') ? 2 : 1) -
          (b.name.includes('header') ? 0 : b.name.includes('footer') ? 2 : 1) ||
        a.name.localeCompare(b.name),
    );

  for (const part of parts) {
    const tree: unknown = parser.parse(decodeEntry(bytes, part));

    const visit = (value: unknown, depth: number) => {
      if (depth > 100) {
        throw new DocumentError('DOCX XML nesting exceeds the limit.');
      }

      for (const node of nodes(value)) {
        for (const [key, children] of Object.entries(node)) {
          if (key === ':@') {
            continue;
          }

          if (key === 'w:tr') {
            const cells = nodes(children).flatMap((child) =>
              child['w:tc'] ? [plain(child['w:tc']).trim()] : [],
            );

            const text = cells.join(' | ');

            if (text) {
              blocks.push({ order: blocks.length + 1, page: null, kind: 'table-row', text });
            }
          } else if (key === 'w:p') {
            const text = plain(children).trim();

            if (text) {
              for (const line of text.split('\n')) {
                blocks.push({
                  order: blocks.length + 1,
                  page: null,
                  kind: part.name.includes('header')
                    ? 'header'
                    : part.name.includes('footer')
                      ? 'footer'
                      : 'paragraph',
                  text: line,
                });
              }
            }
          } else {
            visit(children, depth + 1);
          }

          if (blocks.length > documentLimits.blocks) {
            throw new DocumentError('DOCX reading blocks exceed the limit.');
          }
        }
      }
    };

    visit(tree, 0);
  }

  return finishDocument('docx', blocks, [
    'DOCX follows document XML order, with headers first and footers last. Tables are read row by row; floating layouts may need correction.',
  ]);
}
