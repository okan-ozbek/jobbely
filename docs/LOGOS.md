# Decision: local company logo assets

**Status:** Implemented, updated 6 October 2026. All 77 target companies use local SVGs: 59 sourced vectors, one explicitly documented text fallback, and the shared N/A fallback for Atlassian, Shopify, HubSpot, ServiceNow, Adyen, ASML, Canva, Notion, Vercel, Mistral AI, Cohere, Hugging Face, Perplexity, Anysphere (Cursor), Replit, Lovable and ElevenLabs pending vector review.

## Decision and rationale

Keep company logos in `frontend/public/logos/` and return their same-origin paths as `logoUrl` from the company API. The backend registry owns the association between company and asset; Vite and the production static host serve the files. Job rows, job details and the company directory share one `CompanyLogo` component.

The directory uses reviewed, flat SVG marks from official company sites, Simple Icons, SVGL and Wikimedia Commons. AMD uses a vector wordmark; IBM uses its eight-bar text logo. Visible canvas backgrounds and favicon tiles are removed while preserving logo paths and transparent counters. Clipping rectangles and shapes belonging to the brand mark are retained. No raster image is embedded inside an SVG.

Radix Trading's official site exposes its company name but no suitable flat SVG was found in this audit. Its local SVG renders that name as a simple text fallback, rather than reusing the previous unrelated-looking third-party image or a Radix UI mark. The manifest explicitly records this exception; it is not represented as an official vector logo.

The [source manifest](../frontend/config/company-logos.json) records the domain, source URL, optional source page, asset path, review date, transformation notes, maintenance policy and SHA-256. Logos identify their respective employers; third-party trademarks and source images retain their original ownership. Downloading an image does not assign a new license to it.

## Invariants and fallback

- Browsing loads images from the frontend host only. No runtime logo-service calls, credentials or AI are required.
- Registry paths are restricted to `/logos/<filename>.png`, `.jpg` or `.svg`; they cannot point to a tracking service or traverse directories.
- A company without `logoUrl` receives `/logos/default.svg` during registry validation. Set that path explicitly when no usable logo exists.
- Failed company images switch to the same local N/A logo. The error handler does not repeatedly retry a failed fallback. Changes to the configured source can recover from an earlier failure.
- Images use containment rather than stretching or cropping. Their wrapper reserves space, and their accessible text names the company or explains that its logo is unavailable.
- Logos are presentation metadata. Changing one requires no database migration or ingestion run.
- Directory marks have transparent wrappers and retain flat brand colors. The five home-page marks retain brand colors at 65% opacity, without a surrounding tile. Wide directory wordmarks receive more horizontal space without stretching.

## Maintenance and verification

To replace a vector, download and visually review its source, remove visible canvas backgrounds if needed, save it under the company slug and update the registry association and manifest hash/notes. Source URLs may refer to a page containing an inline SVG. Run these commands from the root:

```sh
pnpm logos:fetch
pnpm format
pnpm logos:check
pnpm check
```

`logos:fetch` preserves entries marked `manual-vector-review`, checking their local static content and hash. These assets need manual replacement because they may contain reviewed background or geometry adjustments; upstream changes must not silently overwrite them. Legacy raster entries still download in batches of four with per-request timeouts, signature/size checks and hash updates. A failed refresh preserves an existing configured asset and exits unsuccessfully. A successful HTTP response alone does not prove brand identity.

`logos:check` is offline and part of `pnpm check`. It verifies every configured path, source record and hash. Reviewed SVGs require a viewBox and reject active elements, embedded images, event handlers, document declarations and external resource references. This is a guard for curated static image assets, not a general-purpose XML sanitizer. Browser review checks rendering, transparency and brand identity; API tests verify `logoUrl` survives serialization.

Production deployments must include Vite's copied `/logos` assets. Paths belong to the frontend origin even when `VITE_API_BASE_URL` points to a separate backend. Missing assets must return HTTP 404 rather than the SPA HTML document. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Implementation

[Company registry](../backend/config/companies.json), [registry validation](../backend/src/infrastructure/registry.ts), [API schemas](../backend/src/api/schemas.ts), [logo component](../frontend/src/components/CompanyLogo.tsx), [local assets](../frontend/public/logos/), [downloader](../scripts/fetch-company-logos.mjs), [asset verification](../scripts/check-company-logos.mjs).
