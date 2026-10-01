import { expect, it } from 'vitest';
import { highlightSegments } from './highlights.js';

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
