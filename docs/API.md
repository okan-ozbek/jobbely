# Decision: stored-data API and generated contract

**Status:** Implemented for the first slice, 30 September 2026.

## Decision and rationale

Use Fastify with TypeBox route schemas for public validation/serialization and generate OpenAPI from those routes. The frontend consumes generated types through `openapi-fetch`, without importing backend models. Provider Zod schemas remain internal and independent of the public contract.

Catalog routes delegate to `JobCatalog`, read stored information and contain no crawling or SQL queries. A stateless resume-analysis POST delegates to `AnalyzeResume`, processes bounded text in memory and does not persist candidates. Operator CLI/worker entry points handle ingestion.

## Routes

| GET route                 | Behavior                                                              |
| ------------------------- | --------------------------------------------------------------------- |
| `/api/v1/jobs`            | Active jobs, filters, total, cursor, dataset version and runtime mode |
| `/api/v1/jobs/facets`     | Company/category/workplace counts for matching active jobs            |
| `/api/v1/jobs/:id`        | Stored detail, including retained closed records; 404 if absent       |
| `/api/v1/companies`       | Company directory with source coverage                                |
| `/api/v1/companies/:slug` | One company's coverage; 404 if absent                                 |
| `/api/v1/categories`      | Canonical taxonomy                                                    |
| `/health/live`            | Process liveness                                                      |
| `/health/ready`           | Repository availability; 503 on failure                               |

Listing filters are `q`, `company`, `category`, `workplace`, `limit` and `cursor`. Comma-separated company/category/workplace values are supported by the catalog. Search is case-insensitive substring matching across title, description text, departments and locations. Results sort by last-seen time descending with ID as a tie-breaker; limit defaults to 20 and is capped at 100.

Company responses include `logoUrl`, a local asset path served by the frontend origin. See [LOGOS.md](LOGOS.md) for ownership, sources and fallback behavior.

## Transient resume analysis

`POST /api/v1/jobs/:id/resume-match` compares an allowlisted reviewed profile against one stored description, returning individual keyword offsets/colors, requirement evidence and explicit recommendation availability. Closed/stale/demo descriptions can be inspected without becoming eligible recommendations. It uses a 256 KiB body limit, `no-store`, allowed-origin validation, generic private errors and 15 requests/minute per connection IP. See [SKILL_RELATIONS](SKILL_RELATIONS.md). Both matching routes accept optional competency IDs/statuses; full resume/contact fields remain rejected.

`POST /api/v1/resume-analysis` accepts strict JSON `text`, an optional valid fixed `analysisDate` no later than today, and optional corrections. The response includes reading lines, evidence, reviewed fields, duration bounds, warnings and versions. No GET/profile-ID retrieval route exists. PDF/DOCX bytes are read locally and are not accepted by the API.

`GET /api/v1/jobs/:id/requirements` returns bounded requirement evidence beside the original job. `POST /api/v1/resume-matches` accepts only the reviewed claim/date/location allowlist, function choices, optional employer context, limit and signed cursor. It returns explained results, coverage/freshness, eligible/evaluated/unenriched counts and versions. Its 256 KiB body, 15/minute connection-IP admission and bounded scans have generic private errors; stale pagination returns 409 and exhausted capacity 503. See [MATCHING](MATCHING.md) and [JOB_FEATURES](JOB_FEATURES.md).

Requests are capped at 768 KiB, text at 100,000 characters/2,000 lines/2,000 characters per line, and corrections at 100 items per array. Errors use generic messages and `no-store` headers; unexpected origins return 403, oversized/unsupported inputs 413/415, and per-IP admission overflow 429. The 60-per-minute budget supports debounced edits. See [RESUME_PRIVACY](RESUME_PRIVACY.md) and [RESUME_TESTING](RESUME_TESTING.md).

## Catalog pagination and errors

A cursor carries dataset version, filter fingerprint and last ID. Invalid/different-filter cursors return 400. A newly published dataset makes prior cursors stale and returns 409, requiring pagination restart. This prevents merging pages from different observations. Cursors are pagination state, not authorization tokens.

Public errors use code/message without internal traces. Unexpected failures return 500 and are logged server-side. Response serialization constrains exposed fields; raw snapshots and hashes are not a public contract.

## Changes and limits

Run `pnpm contracts` after route/schema changes, then type-check frontend consumers. Generated artifacts are [OpenAPI JSON](../contracts/openapi.json) and [frontend types](../frontend/src/api/generated/schema.ts). The build regenerates them. There is no runtime Swagger UI route implemented.

Catalog search/facets/pagination currently operate in memory over a consistent repository snapshot. Move execution into indexed database queries while preserving contract semantics before broad ingestion. Public authentication/rate limiting and projection of smaller listing summaries are future work.

[Routes](../backend/src/api/app.ts), [schemas](../backend/src/api/schemas.ts), [catalog](../backend/src/application/catalog.ts), [API tests](../backend/src/api/app.test.ts), [contract exporter](../backend/src/cli/export-openapi.ts). See [STORAGE.md](STORAGE.md) and [FRONTEND.md](FRONTEND.md).
