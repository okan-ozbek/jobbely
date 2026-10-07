# Decision: stored-data API and generated contract

**Status:** Implemented for the first slice, 30 September 2026.

## Structured evidence update, 2 October 2026

[STRUCTURED_MATCHING](STRUCTURED_MATCHING.md) records the implemented job sections, logical resume blocks, required/preferred/additional groups and bounded source-reference contracts. Analysis is text-3; public features are requirements-13:concepts-2:clauses-2:job-document-1, scoring score-4:relations-3. Single-job comparison exposes completeness, review band and unresolved counts. Matching forwards only allowlisted evidence metadata; resume excerpts remain transient. Earlier dated verification below describes its own increment.

## Decision and rationale

Use Fastify with TypeBox route schemas for public validation/serialization and generate OpenAPI from those routes. The frontend consumes generated types through `openapi-fetch`, without importing backend models. Provider Zod schemas remain internal and independent of the public contract.

Catalog routes delegate to `JobCatalog`, read stored information and contain no crawling or SQL queries. A stateless resume-analysis POST delegates to `AnalyzeResume`, processes bounded text in memory and does not persist candidates. Operator CLI/worker entry points handle ingestion.

## Routes

`GET /api/v1/email-preview/:purpose` renders account email HTML for `register` or `reset` with a fixed synthetic code. It is intentionally unprotected until the admin panel is implemented. It sends no mail and reads no account data; extra query parameters are rejected. See [EMAIL_ACCOUNTS](EMAIL_ACCOUNTS.md).

The 5 October [account foundation](ACCOUNTS.md) adds generated contracts for plans, provider discovery, OAuth start/callback, account reads and logout. The 7 October increment adds `POST /api/v1/account/delete` with strict `{ "confirm": true }` input, an active session issued within ten minutes, exact Origin and session CSRF. Success returns `{ "deleted": true }` and expires both account cookies; deletion never accepts a client user ID. These are session-aware with no-store/origin/CSRF protections as documented there. The draft catalog explicitly reports purchasing/paywall disabled; current anonymous matching routes are not yet tier-enforced.

[EMAIL_ACCOUNTS](EMAIL_ACCOUNTS.md) adds strict POST contracts for `/api/v1/auth/register`, `/auth/register/confirm`, `/auth/password/login`, `/auth/password/reset`, `/auth/password/reset/confirm` and `/auth/email/resend` (each under `/api/v1`). Provider discovery includes `emailAvailable`; account identity includes the user ID and nullable email. Verification codes remain strings to preserve leading zeros. Register/reset requests return a generic challenge receipt after durable queue acceptance, without codes or password hashes. Unknown reset addresses do not enqueue mail. Native account requests have a 4 KiB body limit, exact-Origin validation, no-store/silent logging and durable credential admission in addition to the account-route limiter.

| GET route                 | Behavior                                                                |
| ------------------------- | ----------------------------------------------------------------------- |
| `/api/v1/jobs`            | Active jobs, filters, total, cursor, dataset version and runtime mode   |
| `/api/v1/jobs/facets`     | Company/category/workplace/country/city counts for matching active jobs |
| `/api/v1/jobs/:id`        | Stored detail, including retained closed records; 404 if absent         |
| `/api/v1/companies`       | Company directory with source coverage                                  |
| `/api/v1/companies/:slug` | One company's coverage; 404 if absent                                   |
| `/api/v1/categories`      | Canonical taxonomy                                                      |
| `/health/live`            | Process liveness                                                        |
| `/health/ready`           | Repository availability; 503 on failure                                 |

Listing filters are `q`, `company`, `category`, `workplace`, `country`, `city`, `limit` and `cursor`. Comma-separated company/category/workplace values are supported by the catalog. Country is an ISO alpha-2 code; city is bounded to 200 characters. Both must match the same parsed job location. Facets expose country code/name/count and city value/count, counting each job once per value. Deterministic parsing supports country names, common aliases/office codes, subdivisions and semicolon lists; ambiguous labels remain unknown, and remote regions do not become cities. This is catalog filtering, not eligibility or geocoding. Filters bind cursor fingerprints. Search is case-insensitive substring matching across title, description text, departments and locations. Results sort by last-seen time descending with ID as a tie-breaker; limit defaults to 20 and is capped at 100.

Company responses include `logoUrl`, a local asset path served by the frontend origin. See [LOGOS.md](LOGOS.md) for ownership, sources and fallback behavior.

## Transient resume analysis

The 5 October [qualification update](QUALIFICATIONS.md) extends analysis/corrections and both matching profiles with optional `education` (20 level/field/completion claims) and `skillTenure` (100 skill ID/month claims, integer months 0–600). Institution/contact fields remain rejected. Comparison responses include education judgments, bounded `roleRelevancePoints` and degree/year annotation metrics alongside skill annotations. These fields do not create candidate storage.

`POST /api/v1/jobs/:id/resume-match` compares an allowlisted reviewed profile against one stored description, returning individual keyword offsets/colors, requirement evidence and explicit recommendation availability. Closed/stale/demo descriptions can be inspected without becoming eligible recommendations. It uses a 256 KiB body limit, `no-store`, allowed-origin validation, generic private errors and 15 requests/minute per connection IP. See [SKILL_RELATIONS](SKILL_RELATIONS.md). Both matching routes accept optional competency IDs/statuses; full resume/contact fields remain rejected.

`POST /api/v1/resume-analysis` accepts strict JSON `text`, an optional valid fixed `analysisDate` no later than today, and optional corrections. The response includes reading lines, evidence, reviewed fields, duration bounds, warnings and versions. No GET/profile-ID retrieval route exists. PDF/DOCX bytes are read locally and are not accepted by the API.

`GET /api/v1/jobs/:id/requirements` returns bounded requirement evidence beside the original job. `POST /api/v1/resume-matches` accepts only the reviewed claim/date/location allowlist, function choices, optional employer context, limit and signed cursor. It returns explained results, coverage/freshness, eligible/evaluated/unenriched counts and versions. Its 256 KiB body, 15/minute connection-IP admission and bounded scans have generic private errors; stale pagination returns 409 and exhausted capacity 503. See [MATCHING](MATCHING.md) and [JOB_FEATURES](JOB_FEATURES.md).

Requests are capped at 768 KiB, text at 100,000 characters/2,000 lines/2,000 characters per line, and corrections at 100 items per array. Errors use generic messages and `no-store` headers; unexpected origins return 403, oversized/unsupported inputs 413/415, and per-IP admission overflow 429. The 60-per-minute budget supports debounced edits. See [RESUME_PRIVACY](RESUME_PRIVACY.md) and [RESUME_TESTING](RESUME_TESTING.md).

## Catalog pagination and errors

Native registration confirmation can return `400` with `account_exists` only after valid browser-bound email proof for an occupied native address. It consumes the challenge without changing credentials or issuing a session. Invalid/expired/wrong-browser codes keep the generic `invalid_code` response; request receipts remain generic. See [EMAIL_ACCOUNTS](EMAIL_ACCOUNTS.md).

A cursor carries dataset version, filter fingerprint and last ID. Invalid/different-filter cursors return 400. A newly published dataset makes prior cursors stale and returns 409, requiring pagination restart. This prevents merging pages from different observations. Cursors are pagination state, not authorization tokens.

Public errors use code/message without internal traces. Unexpected failures return 500 and are logged server-side. Response serialization constrains exposed fields; raw snapshots and hashes are not a public contract.

## Changes and limits

Company responses now expose optional `verification` metadata: automatic technical result (`verified`, `partial`, `pending`), check time, bounded blockers and independent access-review status. Coverage reads fresh database evidence; response fields exclude source run IDs and configuration hashes. See [AUTOMATIC_COVERAGE.md](AUTOMATIC_COVERAGE.md).

Run `pnpm contracts` after route/schema changes, then type-check frontend consumers. Generated artifacts are [OpenAPI JSON](../contracts/openapi.json) and [frontend types](../frontend/src/api/generated/schema.ts). The build regenerates them. There is no runtime Swagger UI route implemented.

Catalog search/facets/pagination currently operate in memory over a consistent repository snapshot. Move execution into indexed database queries while preserving contract semantics before broad ingestion. Public authentication/rate limiting and projection of smaller listing summaries are future work.

[Routes](../backend/src/api/app.ts), [schemas](../backend/src/api/schemas.ts), [catalog](../backend/src/application/catalog.ts), [API tests](../backend/src/api/app.test.ts), [contract exporter](../backend/src/cli/export-openapi.ts). See [STORAGE.md](STORAGE.md) and [FRONTEND.md](FRONTEND.md).

Engineering semantic matching now distinguishes full (green), partial (yellow), suggested (purple, zero credit) and absent/denied (red) coverage. Scoped tool-usage/development answers stay transient and invalidate profile review and pagination. Matching accepts bounded semantic metadata, never resume excerpts. See [SEMANTICS.md](SEMANTICS.md) for the implemented registry, context guards, confirmation flow and limits.
