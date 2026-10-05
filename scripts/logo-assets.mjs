import assert from 'node:assert/strict';

// A guard for reviewed, static img assets; source identity still needs visual review.
export function checkSvgLogo(bytes, name) {
  const svg = bytes.toString('utf8');

  assert.ok(bytes.length < 1_000_000, `Oversized SVG logo: ${name}`);

  assert.match(
    svg,
    /^\s*<svg\b[^>]*\bxmlns="http:\/\/www\.w3\.org\/2000\/svg"/,
    `Invalid SVG: ${name}`,
  );

  assert.match(svg, /\bviewBox="[-\d.\s]+"/, `Missing SVG viewBox: ${name}`);
  assert.match(svg, /<\/svg>\s*$/, `Incomplete SVG: ${name}`);

  assert.doesNotMatch(
    svg,
    /<\s*(?:script|foreignObject|image|iframe|object|embed|animate\w*|set)\b/i,
    `Active or raster SVG content: ${name}`,
  );

  assert.doesNotMatch(
    svg,
    /<!|<\?|\bon\w+\s*=/i,
    `Unreviewed SVG declarations or handlers: ${name}`,
  );

  assert.doesNotMatch(
    svg,
    /\b(?:href|xlink:href)\s*=\s*["'](?!#)/i,
    `External SVG reference: ${name}`,
  );

  assert.doesNotMatch(
    svg,
    /(?:url\(\s*["']?(?!#)|@import|javascript:|data:)/i,
    `External SVG styling: ${name}`,
  );
}
