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
