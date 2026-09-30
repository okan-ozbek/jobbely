import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const companies = JSON.parse(
  await readFile(new URL('../backend/config/companies.json', import.meta.url), 'utf8'),
);

const manifest = JSON.parse(
  await readFile(new URL('../frontend/config/company-logos.json', import.meta.url), 'utf8'),
);

await readFile(new URL('../frontend/public/logos/default.svg', import.meta.url));

for (const company of companies) {
  assert.match(company.logoUrl, /^\/logos\/[a-z0-9-]+\.(png|jpg|svg)$/);

  const bytes = await readFile(new URL(`../frontend/public${company.logoUrl}`, import.meta.url));

  if (company.logoUrl === '/logos/default.svg') {
    continue;
  }

  const source = manifest[company.slug];

  assert.equal(source?.asset, company.logoUrl, `Missing source record for ${company.slug}`);

  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    source.sha256,
    `Logo content changed without updating its source record: ${company.slug}`,
  );

  const png = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  const jpeg = bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));

  assert.ok(png || jpeg, `Invalid raster logo: ${company.slug}`);
  assert.equal(company.logoUrl.endsWith('.png'), png, `Incorrect extension: ${company.slug}`);
}

console.log(`Verified ${companies.length} local company logo paths and the N/A fallback.`);
