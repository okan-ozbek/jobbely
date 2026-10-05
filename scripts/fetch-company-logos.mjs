import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { checkSvgLogo } from './logo-assets.mjs';

const registryPath = new URL('../backend/config/companies.json', import.meta.url);
const manifestPath = new URL('../frontend/config/company-logos.json', import.meta.url);
const assetDirectory = new URL('../frontend/public/logos/', import.meta.url);
const companies = JSON.parse(await readFile(registryPath, 'utf8'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

await mkdir(assetDirectory, { recursive: true });

let failed = false;

// Refresh explicitly reviewed URLs only; runtime requests never use this downloader.
for (let offset = 0; offset < companies.length; offset += 4) {
  await Promise.all(
    companies.slice(offset, offset + 4).map(async (company) => {
      const source = manifest[company.slug];

      try {
        if (!source?.sourceUrl) {
          throw new Error('No logo source configured');
        }

        // These curated vectors include reviewed geometry/background adjustments.
        // Never replace them with favicons or silently publish upstream changes.
        if (source.maintenance === 'manual-vector-review') {
          const bytes = await readFile(
            new URL(`../frontend/public${source.asset}`, import.meta.url),
          );

          checkSvgLogo(bytes, company.slug);

          if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) {
            throw new Error(
              'Reviewed SVG hash mismatch; update the source record after visual review',
            );
          }

          console.log(`${company.slug}: preserved reviewed SVG (manual replacement)`);

          return;
        }

        const response = await fetch(source.sourceUrl, { signal: AbortSignal.timeout(20_000) });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const bytes = Buffer.from(await response.arrayBuffer());
        const png = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
        const jpeg = bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));

        if ((!png && !jpeg) || bytes.length > 1_000_000) {
          throw new Error('Expected a PNG or JPEG under 1 MB');
        }

        const filename = `${company.slug}.${png ? 'png' : 'jpg'}`;

        await writeFile(new URL(filename, assetDirectory), bytes);

        company.logoUrl = `/logos/${filename}`;
        source.asset = company.logoUrl;
        source.sha256 = createHash('sha256').update(bytes).digest('hex');
        source.fetchedAt = new Date().toISOString();

        console.log(`${company.slug}: ${bytes.length} bytes`);
      } catch (error) {
        failed = true;

        // Preserve an existing reviewed asset if a refresh fails.
        company.logoUrl ??= '/logos/default.svg';

        console.error(`${company.slug}: ${error.message}`);
      }
    }),
  );
}

await writeFile(registryPath, `${JSON.stringify(companies, null, 2)}\n`);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

if (failed) {
  process.exitCode = 1;
}
