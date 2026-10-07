# Decision: explicit trust boundaries

**Status:** Initial boundaries implemented; public-hosting protections require deployment configuration. Recorded 30 September 2026.

## Decision and rationale

Treat provider responses as external content. Validate structured fields at the adapter boundary, prepare HTML before publication, and expose constrained public job reads and stateless private resume POST routes. Extraction targets come from operator-controlled source configuration and a fixed transport allowlist.

## HTML and data boundaries

HTML preparation decodes once-escaped Greenhouse markup when necessary, then uses `sanitize-html` with explicit tags and link attributes. Script/style content, embedded frames, images and arbitrary event attributes are outside the allowlist. Links permit HTTP, HTTPS and mailto; protocol-relative links are disallowed. Readable text is derived from the sanitized result.

The frontend uses `dangerouslySetInnerHTML` only for the prepared description returned by the API. Keep sanitization before storage/API exposure; do not pass a raw snapshot directly to rendering. Provider-supplied posting/application URLs must be HTTPS without embedded credentials. External application/source anchors in React include `noopener noreferrer`.

Raw payloads remain server-side evidence. Public job response schemas omit internal content hashes and raw snapshots. Provider validation errors summarize at most five issues rather than dumping the entire external payload into an error.

## Hosting and secrets

The 7 October `GET /api/v1/email-preview/:purpose` route is intentionally public at the user's request until admin authorization exists. It renders only a fixed synthetic sample of the registration/reset email; no recipient/code inputs, account/challenge reads or delivery action are exposed. It uses restrictive CSP, `no-store`, `nosniff`, `no-referrer` and `noindex` response headers. This is the only new preview access; see [EMAIL_ACCOUNTS](EMAIL_ACCOUNTS.md).

Database credentials are server-only configuration. `.env` files, generated database clients, raw audit artifacts and database files are ignored by version control. Never put credentials in `VITE_*`: those variables are embedded into the public frontend build. Maintain HTTPS and private database connectivity when hosting.

CORS allows one configured browser origin with credentials for account cookies; it is not authentication or protection against non-browser callers. [ACCOUNTS](ACCOUNTS.md) adds server-owned GitHub/LinkedIn identity and revocable hashed sessions, exact-origin/CSRF logout and account deletion, recent-sign-in deletion admission and silent auth logging. [EMAIL_ACCOUNTS](EMAIL_ACCOUNTS.md) adds scrypt password credentials, browser-bound expiring HMAC codes, reset/session revocation, durable credential admission and encrypted transactional SMTP delivery. Native credentials do not automatically link to SSO by matching email. Admin and ingestion write endpoints remain absent. Private resume routes remain anonymous until preview enforcement is implemented; existing admission and privacy controls still apply. Broader distributed traffic controls remain a deployment gate. Document-worker CSP headers are required below. Public employer content is not certified by validation.

## Transient resume input

Resume analysis and matching accept bounded JSON through stateless POST routes with strict nested schemas, origin/admission limits, `no-store` headers and a private error handler that does not log input-bearing exceptions. Evidence is rendered as React text, not HTML. No candidate storage or server document upload is implemented. PDF/DOCX files are extracted locally in a bounded browser worker whose CSP blocks network access; hosting must supply the documented headers. See [RESUME_PRIVACY](RESUME_PRIVACY.md) and [DOCUMENTS](DOCUMENTS.md) for current isolation controls and limits, and [RESUME_TESTING](RESUME_TESTING.md) for tests. Updated 1 October 2026.

## Implementation and verification

[HTML preparation](../backend/src/infrastructure/html.ts), [URL/schema checks](../backend/src/infrastructure/adapters/schemas.ts), [HTTP allowlist](../backend/src/infrastructure/http.ts), [API response schemas](../backend/src/api/schemas.ts), [HTML regression coverage](../backend/src/application/sync-source.test.ts), [frontend](../frontend/src/App.tsx).

Use [DEPLOYMENT.md](DEPLOYMENT.md) for runtime secrets and public/private networking decisions.
