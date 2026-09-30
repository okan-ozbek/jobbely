# Decision: stored-data API and generated contract

**Status:** Implemented for the first slice, 30 September 2026.

## Decision and rationale

Use Fastify with TypeBox route schemas for public validation/serialization and generate OpenAPI from those routes. The frontend consumes generated types through `openapi-fetch`, without importing backend models. Provider Zod schemas remain internal and independent of the public contract.

The API delegates to `JobCatalog`; it contains no crawling or SQL queries. Its public operations read stored information. Operator CLI/worker entry points handle ingestion.

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

## Pagination and errors

A cursor carries dataset version, filter fingerprint and last ID. Invalid/different-filter cursors return 400. A newly published dataset makes prior cursors stale and returns 409, requiring pagination restart. This prevents merging pages from different observations. Cursors are pagination state, not authorization tokens.

Public errors use code/message without internal traces. Unexpected failures return 500 and are logged server-side. Response serialization constrains exposed fields; raw snapshots and hashes are not a public contract.

## Changes and limits

Run `pnpm contracts` after route/schema changes, then type-check frontend consumers. Generated artifacts are [OpenAPI JSON](../contracts/openapi.json) and [frontend types](../frontend/src/api/generated/schema.ts). The build regenerates them. There is no runtime Swagger UI route implemented.

Catalog search/facets/pagination currently operate in memory over a consistent repository snapshot. Move execution into indexed database queries while preserving contract semantics before broad ingestion. Public authentication/rate limiting and projection of smaller listing summaries are future work.

[Routes](../backend/src/api/app.ts), [schemas](../backend/src/api/schemas.ts), [catalog](../backend/src/application/catalog.ts), [API tests](../backend/src/api/app.test.ts), [contract exporter](../backend/src/cli/export-openapi.ts). See [STORAGE.md](STORAGE.md) and [FRONTEND.md](FRONTEND.md).
