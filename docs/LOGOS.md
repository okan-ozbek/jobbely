# Decision: local company logo assets

**Status:** Implemented, 30 September 2026. All 60 target companies have downloaded logos.

## Decision and rationale

Keep company logos in `frontend/public/logos/` and return their same-origin paths as `logoUrl` from the company API. The backend registry owns the association between company and asset; Vite and the production static host serve the files. Job rows, job details and the company directory share one `CompanyLogo` component.

Most assets are company website icons downloaded from Google's public favicon cache using an explicitly selected company domain. GitHub and Jane Street use higher-resolution icons from their official sites. Radix Trading uses its logo from [The Org's company profile](https://theorg.com/org/radix-trading). These are compact brand marks rather than consistently sized wordmarks; source resolution varies.

The [source manifest](../frontend/config/company-logos.json) records the domain, download URL, optional source page, asset path, fetch timestamp and SHA-256. Logos identify their respective employers; third-party trademarks and source images retain their original ownership. Downloading an image does not assign a new license to it.

## Invariants and fallback

- Browsing loads images from the frontend host only. No runtime logo-service calls, credentials or AI are required.
- Registry paths are restricted to `/logos/<filename>.png`, `.jpg` or `.svg`; they cannot point to a tracking service or traverse directories.
- A company without `logoUrl` receives `/logos/default.svg` during registry validation. Set that path explicitly when no usable logo exists.
- Failed company images switch to the same local N/A logo. The error handler does not repeatedly retry a failed fallback. Changes to the configured source can recover from an earlier failure.
- Images use containment rather than stretching or cropping. Their wrapper reserves space, and their accessible text names the company or explains that its logo is unavailable.
- Logos are presentation metadata. Changing one requires no database migration or ingestion run.

## Maintenance and verification

To add or replace a logo, review its source and add a manifest entry under the company slug. Run these commands from the root:

```sh
pnpm logos:fetch
pnpm format
pnpm logos:check
pnpm check
```

Fetching is an explicit maintenance command requiring network access. It downloads PNG/JPEG assets in batches of four with per-request timeouts, checks their signatures and size, updates registry paths and records hashes. A failed refresh preserves an existing configured asset and exits unsuccessfully. Inspect downloaded replacements before committing; a successful HTTP response alone does not prove brand identity. Do not use the downloader for unreviewed SVGs; the N/A SVG is maintained locally.

`logos:check` is offline and part of `pnpm check`. It verifies that every configured asset and the fallback exist, that raster signatures match extensions, and that assets match their source records. API tests verify `logoUrl` survives response serialization. Browser verification should check directory, listing, detail and failed-image behavior.

Production deployments must include Vite's copied `/logos` assets. Paths belong to the frontend origin even when `VITE_API_BASE_URL` points to a separate backend. Missing assets must return HTTP 404 rather than the SPA HTML document. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Implementation

[Company registry](../backend/config/companies.json), [registry validation](../backend/src/infrastructure/registry.ts), [API schemas](../backend/src/api/schemas.ts), [logo component](../frontend/src/components/CompanyLogo.tsx), [local assets](../frontend/public/logos/), [downloader](../scripts/fetch-company-logos.mjs), [asset verification](../scripts/check-company-logos.mjs).
