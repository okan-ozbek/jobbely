# Decision: explicit trust boundaries

**Status:** Initial boundaries implemented; public-hosting protections require deployment configuration. Recorded 30 September 2026.

## Decision and rationale

Treat provider responses as external content. Validate structured fields at the adapter boundary, prepare HTML before publication, and expose a constrained read-only API. Extraction targets come from operator-controlled source configuration and a fixed transport allowlist.

## HTML and data boundaries

HTML preparation decodes once-escaped Greenhouse markup when necessary, then uses `sanitize-html` with explicit tags and link attributes. Script/style content, embedded frames, images and arbitrary event attributes are outside the allowlist. Links permit HTTP, HTTPS and mailto; protocol-relative links are disallowed. Readable text is derived from the sanitized result.

The frontend uses `dangerouslySetInnerHTML` only for the prepared description returned by the API. Keep sanitization before storage/API exposure; do not pass a raw snapshot directly to rendering. Provider-supplied posting/application URLs must be HTTPS without embedded credentials. External application/source anchors in React include `noopener noreferrer`.

Raw payloads remain server-side evidence. Public job response schemas omit internal content hashes and raw snapshots. Provider validation errors summarize at most five issues rather than dumping the entire external payload into an error.

## Hosting and secrets

Database credentials are server-only configuration. `.env` files, generated database clients, raw audit artifacts and database files are ignored by version control. Never put credentials in `VITE_*`: those variables are embedded into the public frontend build. Maintain HTTPS and private database connectivity when hosting.

CORS allows one configured browser origin; it is not authentication or protection against non-browser callers. The current API has no accounts, authenticated admin routes or ingestion write endpoint. API rate limiting, edge traffic controls, CSP/security headers and retention policy are deployment/MVP follow-ups. Public job content may still contain ordinary external links and organization-supplied text; validation does not certify that content.

## Transient resume input

Resume analysis accepts bounded JSON text through a separate stateless POST route with strict nested schemas, origin/admission limits, `no-store` headers and a private error handler that does not log input-bearing exceptions. Evidence is rendered as React text, not HTML. No candidate storage or document upload is implemented. See [RESUME_PRIVACY](RESUME_PRIVACY.md) for current controls and future file-isolation requirements, and [RESUME_TESTING](RESUME_TESTING.md) for tests.

## Implementation and verification

[HTML preparation](../backend/src/infrastructure/html.ts), [URL/schema checks](../backend/src/infrastructure/adapters/schemas.ts), [HTTP allowlist](../backend/src/infrastructure/http.ts), [API response schemas](../backend/src/api/schemas.ts), [HTML regression coverage](../backend/src/application/sync-source.test.ts), [frontend](../frontend/src/App.tsx).

Use [DEPLOYMENT.md](DEPLOYMENT.md) for runtime secrets and public/private networking decisions.
