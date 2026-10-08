# Plan: restore usable resume analysis and scale matching

**Status:** Proposed, 8 October 2026 (Europe/Amsterdam). Code review, primary-source research and bounded local read-only probes completed. No optimization, source refresh, schema migration or deployment performed.

**Scope:** Restore the present deterministic flow first, then provide a measured foundation for the semantic roadmap. [RESUME_MATCHING_REWORK](RESUME_MATCHING_REWORK.md) still owns the semantic replacement; this plan sequences performance work without selecting or installing models.

## Findings: reliability, queries and matching are separate

Inspection used a fictional short resume and a fictional structured Python profile. No real candidate document, account or private database record was inspected. Database probes ran read-only with statement timeouts. These are single local observations, not p95 benchmarks.

| Observation on 8 October   | Result                                                                                                        | Implication                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored public jobs         | 16,863 postings, all marked active                                                                            | Capacity is substantially beyond a few thousand. Active catalog status alone does not establish recommendation freshness.                      |
| Posting JSON               | 117.29 MiB stored datum sizes; 220.85 MiB expanded JSON text                                                  | Full snapshot transfers/materialization are expensive. These are aggregate SQL sizes, not measured per-request network bytes or JS heap usage. |
| Public features            | 16,845 rows, current `requirements-15:concepts-3:clauses-2:job-document-1`; 21 postings missing or hash-stale | Existing features/indexes are largely present; catch-up is still needed.                                                                       |
| Expanded feature JSON      | 794.96 MiB across all features                                                                                | The indexed matcher still reads large requirement documents; batching does not eliminate total transfer.                                       |
| Run history                | 657 runs; two still marked running                                                                            | Recovery and retention deserve attention; do not erase abandoned evidence blindly.                                                             |
| Fresh sources              | 0 of 70 latest completed source runs passed successful/exhaustive/non-quarantined/36-hour checks              | No jobs can currently be recommended under the implemented availability policy.                                                                |
| Ingestion service          | Exited; historical final error is PostgreSQL connectivity; older image than API                               | Recover and inspect current worker behavior before blaming matching capacity.                                                                  |
| Internal HTTP readiness    | 200, 22 ms                                                                                                    | Database/API reachable at probe time.                                                                                                          |
| Short pasted-text analysis | 200, 71 ms                                                                                                    | Minimal analysis works independently of job count; does not reproduce the user's particular document failure.                                  |
| Companies request          | 200, 2,934 ms                                                                                                 | Directory metadata currently pays full dataset-read cost.                                                                                      |
| Matching request           | 200, 2,534 ms; eligible/evaluated/unenriched 0; excluded sources 70                                           | Even empty matching waits on full-catalog coverage work. No current full-corpus scoring latency was measured.                                  |
| Narrow SQL examples        | Active counts by source: 2.319 ms; latest completed runs: 0.827 ms, warm `EXPLAIN ANALYZE`                    | Small query-oriented reads look promising; these examples are not drop-in complete coverage implementations.                                   |
| Docker API memory sample   | About 1.985 GiB after probes                                                                                  | Investigate allocation/GC and concurrent snapshot loads; this sample does not prove a memory leak.                                             |

The newest successful run was `2026-10-07T01:03:14.371Z`; database observation time was `2026-10-08T16:19:36Z`. Do not extend freshness or treat stale listings as current to make the UI show results. A successful small text probe also cannot establish that PDF/DOCX reading, large analysis requests, browser isolation headers or the user's real profile succeed.

## Code paths causing avoidable work

1. [PostgresJobRepository.read](../backend/src/infrastructure/storage/postgres.ts) loads every Posting and Run, including full JSON, in repeatable read. [JobCatalog](../backend/src/application/catalog.ts) calls it separately for jobs, facets, single-job lookup and company coverage. Filtering, sorting, counts and repeated per-company history scans then run in JS. Existing indexes cannot accelerate predicates performed only after loading every row.
2. [useJobCatalog](../frontend/src/hooks/useJobCatalog.ts) issues jobs, companies, categories and two facet requests together on each query change. [App](../frontend/src/App.tsx) mounts this hook even on resume/pricing/account views. Three or four requests can independently read the entire corpus; `Promise.all` also delays visible jobs until the slowest metadata request finishes. HTTP abort does not currently propagate to cancel this backend database work.
3. [Matching routes](../backend/src/api/matching-routes.ts) run `catalog.coverage()` alongside matching and await both. Consequently an empty match still loads all descriptions to label companies.
4. [MatchJobs](../backend/src/application/resume/match-jobs.ts) already prepares candidate relations once and scans hash/version-valid, eligible features in 250-row batches. It retains only the best page, but [featureJobs](../backend/src/infrastructure/storage/feature-postgres.ts) transfers full requirement JSON for every scored row. [scoreJob](../backend/src/domain/matching/score.ts) builds detailed explanation arrays for all jobs; each result is inserted into and sorts the retained page. Every pagination POST rescans the eligible corpus.
5. Matching rejects more than 50,000 eligible jobs, more than a ten-second scan, or more than two simultaneous matcher requests per API process. These are explicit limits, not silent sampling. The scan timer excludes initial snapshot/run queries and route coverage overhead. Frequent dataset/feature changes invalidate signed cursors or in-flight results with 409; parallel ingestion can increase this churn.
6. [AnalyzeResume](../backend/src/application/resume/analyze-resume.ts) is synchronous deterministic text interpretation with configured employer identities; it does not fetch or compare all jobs. The Ollama adapter is a separate public-job shadow experiment, not the live resume-analysis path. Model tuning cannot fix the confirmed full-catalog problem.

Current behavior remains governed by [MATCHING](MATCHING.md), [JOB_FEATURES](JOB_FEATURES.md), [STRUCTURED_MATCHING](STRUCTURED_MATCHING.md), [SKILL_RELATIONS](SKILL_RELATIONS.md), [RESUME_PRIVACY](RESUME_PRIVACY.md) and [DOCUMENTS](DOCUMENTS.md).

## Delivery plan

### P0: regain reliable behavior and establish a baseline

- Recover ingestion using the current backend image and database-ready startup, preserving source gates. Inspect failed/abandoned runs, leases, worker heartbeat, projection lag and fresh successful sources. Add operator visibility/alerts for worker death and freshness exhaustion. Recovery is linked to phase 0 of [RANKED_SYNC_PLAN](RANKED_SYNC_PLAN.md), independent of removing waves.
- Reproduce the full browser flow with synthetic pasted text, PDF and DOCX: local parsing/isolation → analysis → review → matching → pagination → one-job comparison. Distinguish 400/403/409/429/503, parser failure, empty eligible corpus and genuine timeout. Show actionable stage-specific UI messages instead of indefinite loading. Investigate the user's exact failure separately without logging or committing their resume.
- Add safe timings for parser duration, analysis, query/pool wait, bytes/rows materialized, scoring, winner explanations, coverage and serialization. Use request IDs and aggregate counters only; exclude text, excerpts, profiles, profile fingerprints and embeddings. Measure CPU, event-loop delay/utilization, heap/RSS, GC, DB lock waits and concurrency.
- Establish an isolated, reproducible public/synthetic corpus with fresh run evidence at 10k, 25k, 50k and 100k jobs. Existing 25k unit tests are not a load test. Never advance live timestamps or bypass freshness to manufacture a benchmark.

### P1: replace interactive full snapshots and redundant fetching

Add query-oriented catalog ports with PostgreSQL and memory implementations; application policies retain ownership of semantics. Preserve atomic/version-consistent reads and existing cursor invalidation.

- Company directory/coverage: group active counts in SQL; fetch latest runs and current `CompanyCoverage` rows plus configuration. Fetch no description JSON. Preserve latest-running/failed status, stale checks, exact run binding and expiry semantics; the simple diagnostic queries above omit these details.
- Single job: primary-key lookup for just that job. Requirements and comparisons fetch only the needed job/feature revision.
- Job pages: indexed predicates, database counts and keyset ordering by `(lastSeenAt DESC, id ASC)`. Use bounded summaries where a contract change is justified, loading description on detail selection. Regenerate contracts if response schemas change.
- Facets: SQL aggregation over filtered jobs, with one count per job/country/city value. Precompute normalized public location tokens at ingestion; preserve current country/city behavior and dependent filter scopes. Use a map/group operation rather than repeated JS `values.filter` calls if memory mode remains.
- Frontend: load companies only where needed; keep static categories independent; deduplicate country/city facet requests when their filters coincide. Render job results without waiting for unrelated metadata. Preserve abort/sequence checks and enabled filter controls.
- Matching route: request compact coverage only for returned company slugs, with revision-aware caching. Empty matching should not scan postings. Keep public labels consistent with the validated result revision, or restart if source evidence changes.

Candidate index shapes to benchmark, not create blindly: active posting company/category and keyset columns; typed `lastSeenAt`/`missingSince`/workplace; run source/completion ordering; normalized location lookup; existing feature hash/version joins. Write typed columns and JSON atomically, migrate/backfill and prove they agree. Use `EXPLAIN (ANALYZE, BUFFERS)` to compare representative plans, including empty and selective queries. A sequential aggregate over small metadata rows can be appropriate.

For existing substring search, benchmark escaped literal `ILIKE` against a maintained normalized search document and `pg_trgm`. Explicitly preserve case, punctuation, whitespace and literal `%`/`_` behavior. Full-text `tsvector`/GIN search is an optional product-semantic change, not a transparent replacement for `.includes()`. Short terms may still scan. [PostgreSQL's trigram documentation](https://www.postgresql.org/docs/17/pgtrgm.html) documents supported operators and short-pattern limitations; [full-text indexing](https://www.postgresql.org/docs/17/textsearch-indexes.html) describes the separate search approach.

### P2: cache public work with precise invalidation

Start with bounded per-process public caches and request coalescing; add distributed caching only when multiple API replicas and measurements justify it.

| Cached public data                       | Identity/invalidation                                                             | Boundaries                                                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Static company/category configuration    | Registry/configuration version                                                    | No account or resume state.                                                                                                     |
| Counts, compact coverage and facets      | Dataset revision, normalized query, latest run/coverage changes, registry version | Time expiry also invalidates freshness; dataset version alone misses run failures and coverage updates. Cap cache size and TTL. |
| Prepared scoring features                | Posting hash, extraction/projection and scoring versions                          | Compact immutable public structures; avoid caching the entire 795 MiB feature JSON per replica.                                 |
| Public requirement/detail interpretation | Posting hash plus interpretation policy version                                   | Fetch explanation blocks only for requested/winning jobs.                                                                       |

Coalesce simultaneous misses without holding one stale promise indefinitely after failure. Recheck versions before serving mixed results; do not serve expired healthy/available labels. Consider revision-versioned aggregate tables or materialized public summaries only if SQL aggregates remain costly, with explicit publication and freshness handling. Do not introduce a large full-dataset cache as the permanent substitute for narrow queries.

Do not persist or share candidate profiles, raw resumes, private match results or candidate embeddings in Redis, PostgreSQL, browser storage, durable queues or public caches. Keep private responses `no-store`. Browser memory can reuse the reviewed result page until edit/clear/reload. Server-side session result caching would change the current stateless boundary and needs a separate privacy decision; it is not part of the initial optimization.

### P3: make exact deterministic matching cheaper

- Separate compact ranking inputs/results from detailed explanations. Compile public requirements into the fields actually used for credit, constraints, deduplication, block roles and coverage; omit full document blocks and repeated excerpts from the hot scan. Generate detailed explanations for the final page from the exact same selected revision. Do not omit unknown criteria or required alternatives just to shrink payloads.
- Preserve candidate preparation once per request. Reuse public normalized requirement keys and maps across comparisons. Benchmark a bounded heap for top `limit + 1` rather than sorting after every row; page sizes are small, so payload/scoring work likely matters more.
- Tune batches after measuring transfer, memory and cancellation latency; increasing 250 is not inherently faster. Use a bounded prepared-feature cache with a byte ceiling. Group by public function/revision for storage locality, while evaluating every job allowed by explicit user filters.
- Add end-to-end deadlines and transport cancellation through application ports to query/worker execution. Evaluate a bounded reusable Node worker-thread pool only if CPU/event-loop measurements justify it; keep DB I/O in adapters and avoid copying huge feature documents per task. Thread handoff stays transient with memory cleanup, cancellation and private error rules. Ingestion workers and interactive CPU workers require separate budgets.
- Keep current pagination stateless initially. Pages may still require rescoring; measure this explicitly. Do not hide the cost with a cross-user profile cache. Retain signed profile/policy/revision binding and freshness anchors. First reduce scan duration and coalesce public projection publication; a future immutable public dataset revision scheme could reduce 409 churn, but must still revalidate availability and cannot return stale recommendations.

Every behavior-preserving optimization must match the exhaustive baseline for ordered IDs, bands, fit, criterion counts, gaps, alternatives, contextual points, uncertainty, colors and cursor page boundaries. [Node 24 worker documentation](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html) recommends a pool for repeated CPU tasks; moving I/O into new threads is not the proposed fix.

### P4: retrieval for semantic matching or larger catalogs

Only after P0–P3 measurements and the semantic evaluation gates, extend [RESUME_MATCHING_REWORK](RESUME_MATCHING_REWORK.md): precompute public job/task embeddings once per content/model revision, encode reviewed candidate evidence transiently, retrieve a union of exact identity signals and semantic candidates, then rerank/compare a bounded shortlist. Start with exact vector search to establish quality and latency; evaluate pgvector HNSW/IVFFlat only if necessary. No Elasticsearch, vector database or model service is needed to fix today's empty-match/catalog overhead.

Benchmark shortlist sizes such as 100/300/1,000; none is the chosen production cutoff. Measure retrieval recall against both exhaustive reference results and independent human relevance labels, by function and difficult paraphrase/domain cases. Include unknown skills, sparse profiles, alternative requirements and atypical career paths. No speed gain can compensate for silently excluding relevant jobs. Missing exact skill overlap, inferred category or ranking-company size must not become hard eligibility gates. Use broader/exhaustive fallback for insufficient retrieval evidence; make any approximate-search product behavior explicit.

[Sentence Transformers' retrieve/rerank reference](https://sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html) motivates doing expensive pair comparison on retrieved candidates. [pgvector's maintained documentation](https://github.com/pgvector/pgvector#filtering) notes that approximate filtering can reduce returned candidates and describes iterative scans; test recall under availability/category filters, not just unfiltered vectors. Similarity is a retrieval hint, never qualification proof, skill tenure or a hiring probability.

## Proposed acceptance targets and verification

Targets below are initial engineering budgets, not achieved results. Record hardware/Node/PostgreSQL versions, corpus size, cache state, payload lengths and ingestion load with every measurement. Recalibrate documented targets if necessary; do not silently weaken them.

| Operation                                                           | Initial target                                                                                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Short/ordinary pasted analysis, up to 10k characters                | p95 ≤ 1 second; maximum valid inputs remain bounded and cancellable.                                                          |
| Company directory / single-job read / ordinary indexed page         | p95 ≤ 300 ms warm and ≤ 1 second cold at 50k jobs.                                                                            |
| Exact first match page                                              | p95 ≤ 2 seconds at 10k eligible jobs; ≤ 5 seconds at 50k.                                                                     |
| Two concurrent match requests plus catalog and four ingestion lanes | No OOM; ordinary read p95 ≤ 1 second; admitted matching stays within its deadline. Excess work returns actionable busy state. |
| Public feature readiness                                            | Provisional p95 ≤ 5 minutes after successful import; freshness/lag explicitly visible.                                        |

For behavior-preserving P1–P3 changes, require exact baseline parity rather than an allowed quality percentage loss. For future semantic retrieval, require an agreed held-out recall/quality gate before rollout, alongside semantic roadmap acceptance. Do not invent a guarantee from the current synthetic suite.

Run representative cold/warm samples and sustained mixed-load tests, including 100k growth/failure tests, maximum valid profiles, unavailable DB, stale sources, cancelled clients and concurrent revisions. Track p50/p95/p99, busy/error rates, SQL rows/bytes, query/pool time, allocations/RSS, event-loop delay, projection lag and source freshness. Verify private data never enters metrics, traces, queues or caches. Test browser responsiveness and file/paste failures with synthetic fixtures per [RESUME_TESTING](RESUME_TESTING.md).

Database migrations/query changes need isolated PostgreSQL parity/race tests; memory tests cannot prove locking or SQL behavior. Preserve lifecycle/source gates, timestamp consistency, feature hash/version rejection, signed cursor changes and rollback. Run scoped formatting, relevant types/tests, `pnpm contracts` for public schema changes, final zero-warning `pnpm lint`, and `pnpm check` before release. Implementation should land in small measurable increments: **recovery → narrow coverage/catalog reads → public cache/fetch reduction → compact exact ranking → optional semantic retrieval**.

## Research sources and limits

Primary sources checked on 8 October 2026:

- [PostgreSQL 17 EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html): inspect real execution/row/buffer work. Planner costs exclude client transmission/conversion, so SQL time alone is insufficient.
- [PostgreSQL pg_stat_statements](https://www.postgresql.org/docs/17/pgstatstatements.html): aggregate query statistics for later workload measurement; enabling it requires deployment configuration. Review query-text exposure and limit collection to public-data queries.
- [PostgreSQL expression indexes](https://www.postgresql.org/docs/17/indexes-expressional.html): index expressions used by queries, with write-maintenance tradeoffs. Typed lookup columns remain a candidate for frequently queried fields.
- [Prisma query optimization](https://www.prisma.io/docs/orm/v7/prisma-client/queries/advanced/query-optimization-performance): avoid overfetching and unnecessary queries. This code's dominant issue is full-snapshot reads, not a demonstrated per-job N+1 loop.
- [Node 24 performance hooks](https://nodejs.org/docs/latest-v24.x/api/perf_hooks.html): event-loop delay/utilization and timing instrumentation.

The other primary references are linked at the relevant proposed change above. No production concurrency benchmark, full eligible-corpus scoring probe, original candidate failure reproduction or independent semantic quality evaluation ran in this planning task. Neither plan is a claim that performance is fixed.
