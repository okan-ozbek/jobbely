interface Span {
  position: number;
  length: number;
}

export function highlightSegments<T extends Span>(text: string, spans: T[]) {
  const result: { text: string; span?: T }[] = [];
  let offset = 0;

  for (const span of [...spans].sort((a, b) => a.position - b.position)) {
    if (
      !Number.isInteger(span.position) ||
      !Number.isInteger(span.length) ||
      span.position < offset ||
      span.length < 1 ||
      span.position + span.length > text.length
    ) {
      continue;
    }

    if (span.position > offset) {
      result.push({ text: text.slice(offset, span.position) });
    }

    result.push({ text: text.slice(span.position, span.position + span.length), span });
    offset = span.position + span.length;
  }

  if (offset < text.length) {
    result.push({ text: text.slice(offset) });
  }

  return result;
}

// Canonical offsets refer to prepared plain text. Align its non-whitespace
// characters to original HTML text nodes, preserving paragraphs and emphasis.
// A content mismatch fails closed; never highlight a different occurrence.
export function mapHtmlHighlights<T extends Span>(nodes: string[], text: string, spans: T[]) {
  const compact = (value: string) => value.replace(/\s/g, '');

  const result: (T & { position: number; length: number })[][] = nodes.map(() => []);

  if (nodes.map(compact).join('') !== compact(text)) {
    return result;
  }

  const prefix = [0];

  for (const char of text.split('')) {
    prefix.push(prefix.at(-1)! + (/\s/.test(char) ? 0 : 1));
  }

  const valid = highlightSegments(text, spans).flatMap((segment) =>
    segment.span ? [segment.span] : [],
  );
  const ranges = valid.map((span) => ({
    span,
    start: prefix[span.position]!,
    end: prefix[span.position + span.length]!,
  }));
  let compactOffset = 0;
  let rangeIndex = 0;

  nodes.forEach((node, nodeIndex) => {
    let start = -1;
    let active: (typeof ranges)[number] | undefined;

    const finish = (end: number) => {
      if (active && start >= 0) {
        result[nodeIndex]!.push({ ...active.span, position: start, length: end - start });
      }

      start = -1;
    };

    for (let index = 0; index < node.length; index++) {
      if (/\s/.test(node[index]!)) {
        continue;
      }

      while (ranges[rangeIndex] && ranges[rangeIndex]!.end <= compactOffset) {
        rangeIndex++;
      }

      const range = ranges[rangeIndex];
      const next =
        range && range.start <= compactOffset && compactOffset < range.end ? range : undefined;

      if (next !== active) {
        finish(index);
        active = next;

        if (active) {
          start = index;
        }
      }

      compactOffset++;
    }

    finish(node.length);
  });

  return result;
}
