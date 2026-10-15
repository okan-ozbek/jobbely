# Performance: indexed reads without application caching

**Status:** Implemented 15 October 2026. Replaces the older performance and ranked-worker proposals. Ingestion now shares the ordered company queue across configurable replicas; financial ranking and fixed worker lanes remain unimplemented. [INGESTION](INGESTION.md) owns scaling and shared provider budgets.

## Read paths

Keep one canonical posting and one public feature row per posting. Category-specific tables would duplicate publication and lifecycle rules; indexed category/source predicates provide selective reads in the current corpus.

- Catalog search reads a database-maintained lowercase search document with a partial trigram GIN index. Literal substring behavior, including `%`, `_` and backslashes, is preserved. Short terms may still require a scan. Unfiltered metadata reads and primary-key detail lookups retain the earlier compact catalog path.
- Matching eligibility uses stored observation/missing metadata instead of decompressing posting JSON. A partial category/source/ID index supports eligible scans, and a completed-source-run index supports freshness lookup.
- Each feature has a database-maintained compact `ranking` projection: full clause/block text, warnings and skill/experience display excerpts are excluded. Constraint/unparsed excerpts remain because they define criterion identity. Scoring uses the same pure policy; no skill prefilter can silently discard gaps or change ranking.
- Matching reads 500-row batches, prepares candidate relations once, and retains only page-size-plus-one winners using binary insertion. Full evidence is loaded only for the displayed page and rescored for complete explanations. Before returning, dataset/feature/run revisions and evaluated counts are checked again. Pagination remains stateless and rescans the eligible corpus; profiles/results are never cached or stored.

[Migration](../backend/prisma/migrations/202610150001_read_projections/migration.sql) backfills public projections and installs triggers for both new and older writers. Hash/version joins, stable identities, original observations, lifecycle rules and scoring weights do not change. Apply migrations before API/worker deployment. The migration needs `pg_trgm` extension privileges and takes write locks while backfilling/indexing; plan a maintenance window for larger databases.

## Local measurements

Same local PostgreSQL public corpus and fictional profile, no application/result cache, 15 October 2026. Normal PostgreSQL/OS buffers were not disabled. These single-request observations do not establish production p95 or concurrent capacity.

| Operation                                   | Before          | After  |
| ------------------------------------------- | --------------- | ------ |
| Engineering, 5,010 eligible jobs            | Timeout, 10.9 s | 1.44 s |
| All five categories, 7,860 eligible jobs    | Timeout, 14.1 s | 1.99 s |
| Catalog text `TypeScript`, 1,066 matches    | 3.95 s          | 76 ms  |
| Catalog literal `%`, 5,764 matches          | 4.19 s          | 628 ms |
| Unfiltered catalog page, 21,015 active jobs | 111 ms          | 87 ms  |

Ten-second/50,000-job scan bounds and admission limits remain explicit. The timeout message now names job matching and suggests a narrower category. Full-corpus scans, frequent publication invalidating cursors, synchronous scoring on the API thread, and application-side location facets/pagination remain limits to measure at larger scale. No freshness or coverage gate is relaxed to improve timings.

Across 21,015 stored features, expanded ranking JSON measured 296.7 MiB versus 1,107.9 MiB for full requirements (about 73% less); stored sizes were 74.7 versus 312.7 MiB. `EXPLAIN (ANALYZE, BUFFERS)` confirmed the trigram bitmap index scan for `TypeScript`; a metadata/feature batch used a 35 ms hash-join/top-N plan. Plans may legitimately choose sequential scans over small metadata sets.

Live API checks returned HTTP 200 for all-category matching and its next page (2.85/2.09 seconds, 20 results each, no duplicates, full evidence, `no-store`). Text-search/page, facets and companies returned 200 in 283/260/30 ms respectively. Timings vary with database buffers and concurrent work. Final `pnpm check` passed, with separate PostgreSQL-enabled backend and final affected integration checks; local documentation links/anchors were validated.

## Code and verification

[Catalog queries](../backend/src/infrastructure/storage/postgres.ts), [feature reads](../backend/src/infrastructure/storage/feature-postgres.ts), [matching](../backend/src/application/resume/match-jobs.ts), [scoring](../backend/src/domain/matching/score.ts), [projection parity tests](../backend/src/infrastructure/storage/ranking-projection.test.ts), [storage integration](../backend/src/infrastructure/storage/postgres.test.ts).

Use a dedicated `jobbely_test_*` database for projection synchronization, old-writer/direct-field correction, literal search parity, hash invalidation and concurrent publication checks. The matching suite covers bounded 25k scans, exact ordering/pagination and revision changes. Measure SQL plans and complete HTTP requests separately; never log candidate payloads or fingerprints. [QUALITY](QUALITY.md) owns completion checks and [INGESTION](INGESTION.md) owns the consolidated worker.

Run `pnpm benchmark:reads` (or `pnpm benchmark:reads --samples 1`) against the configured database to repeat aggregate matching/catalog timings with a built-in fictional profile. It performs no imports or AI calls and prints no candidate/job excerpts. It uses real freshness gates; low/zero eligible counts cannot establish full-corpus speed.
