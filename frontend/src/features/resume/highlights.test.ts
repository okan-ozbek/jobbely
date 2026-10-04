import { expect, it } from 'vitest';
import { highlightSegments, mapHtmlHighlights } from './highlights.js';

it('preserves the full description and safely segments repeated keywords, Unicode and literal markup', () => {
  const text = '<script>λ C++ AWS\nAWS</script>';

  const segments = highlightSegments(text, [
    { position: 10, length: 3 },
    { position: 14, length: 3 },
    { position: 18, length: 3 },
  ]);

  expect(segments.map((item) => item.text).join('')).toBe(text);

  expect(segments.filter((item) => item.span).map((item) => item.text)).toEqual([
    'C++',
    'AWS',
    'AWS',
  ]);
});

it('maps offsets across HTML emphasis without highlighting the earlier contextual occurrence', () => {
  const nodes = ['We use storage systems.', 'Required:', 'Build ', 'storage', ' systems', ' with C++ λ.'];
  const text = 'We use storage systems.\nRequired:\nBuild storage systems with C++ λ.';
  const position = text.lastIndexOf('storage systems');
  const spans = mapHtmlHighlights(nodes, text, [{ position, length: 'storage systems'.length, id: 'storage' }]);

  expect(spans[0]).toEqual([]);
  expect(spans[3]).toEqual([{ position: 0, length: 7, id: 'storage' }]);
  expect(spans[4]).toEqual([{ position: 1, length: 7, id: 'storage' }]);
  expect(nodes.map((node, index) => highlightSegments(node, spans[index]!).map((segment) => segment.text).join('')).join('')).toBe(nodes.join(''));
});

it('fails closed on different HTML content and rejects invalid offsets', () => {
  expect(mapHtmlHighlights(['Use Redis'], 'Use AWS', [{ position: 4, length: 3 }])).toEqual([[]]);
  expect(mapHtmlHighlights(['Use Redis'], 'Use Redis', [{ position: -1, length: 5 }, { position: 4, length: 999 }])).toEqual([[]]);
});

it('ignores overlapping, invalid and out-of-bounds annotations without dropping text', () => {
  const text = 'Redis AWS';

  const segments = highlightSegments(text, [
    { position: -1, length: 5 },
    { position: 0, length: 5 },
    { position: 2, length: 5 },
    { position: 6, length: 3 },
    { position: 999, length: 2 },
  ]);

  expect(segments.map((item) => item.text).join('')).toBe(text);
  expect(segments.filter((item) => item.span)).toHaveLength(2);
});
