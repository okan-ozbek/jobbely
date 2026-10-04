# Decision: indexed public job features and replayable backfill

**Status:** Implemented and PostgreSQL integration-tested 1 October 2026, Europe/Amsterdam. General catalog search remains on its existing snapshot path.

## Structured evidence update, 2 October 2026

[STRUCTURED_MATCHING](STRUCTURED_MATCHING.md) records the implemented job sections, logical resume blocks, required/preferred/additional groups and bounded source-reference contracts. Analysis is text-3; public features are requirements-13:concepts-2:clauses-2:job-document-1, scoring score-4:relations-3. Single-job comparison exposes completeness, review band and unresolved counts. Matching forwards only allowlisted evidence metadata; resume excerpts remain transient. Earlier dated verification below describes its own increment.

## Storage and invariants

`JobFeature` is a projection of public employer descriptions, with posting FK, content hash, extraction/vocabulary version, category, skill IDs and bounded requirement JSON. It stores no candidate fields. The [migration](../backend/prisma/migrations/202610010001_job_features/migration.sql) adds a version/category/posting index, a skill-array GIN index, an active/category/source/posting lookup index and `DatasetVersion.featureGeneration`. The GIN index is available for future prefilters; current ranking evaluates all eligible feature rows rather than filtering out candidates missing required skills.

Only a projection matching the current posting content hash and feature policy version may be read. Changed content or policy makes old features unenriched immediately; a successful ingestion does not require enrichment to succeed. Content hash includes normalized classification/location/description inputs. Increment requirement/vocabulary versions whenever interpretation changes, then backfill.

[The storage port](../backend/src/ports/job-features.ts) exposes bounded pending inputs, compare-and-publish, latest completed runs, snapshot counts and compact feature batches. Application code contains no Prisma or provider dependencies. [PostgreSQL](../backend/src/infrastructure/storage/feature-postgres.ts) implements it with parameterized queries; [memory storage](../backend/src/infrastructure/storage/feature-memory.ts) supports deterministic behavior tests.

## Publication and race protection

Backfill reads at most 100 pending postings at a time by stable ID. Extraction happens outside the write transaction. Publication takes the same global advisory lock as ingestion (721049), checks current content hash under a row-share lock, and conditionally upserts only changed hash/version rows. Generation advances once for each transaction with actual changes. Writers and ingestion share lock order, avoiding opposite-order posting/version locks. Concurrent identical backfills publish once; stale extraction inputs cannot overwrite a newer posting feature.

If a job changes during an ID scan, it remains visibly unenriched and is picked up by the next backfill. Runs and feature generation are checked before/after matching; any concurrent data change aborts the result rather than returning a mixed revision. Snapshot counts use repeatable read; ranking fetches compact feature/public-summary rows in 250-row chunks and never fetches all descriptions for each candidate.

## Operation

```powershell
pnpm db:migrate
pnpm features:backfill
```

Set the normal PostgreSQL environment first. Backfill is replayable and outputs inspected/updated counts only. Operator sync performs a backfill after imports. The worker schedules `backfill-job-features` every 15 minutes and also backfills after a successful scheduled sync. These queues contain public job work, never resumes. API startup does not mutate/backfill the database; run migrations/backfill before releasing new feature versions. Missing features are reported explicitly in matching responses.

Matching capacity, eligibility, ranking and signed cursor semantics belong to [MATCHING](MATCHING.md). Additive migration leaves existing job versions/source IDs intact. Projection is derivative and can be rebuilt; no candidate state is recoverable from it.

## Verification and limits

[Backfill use case](../backend/src/application/resume/job-features.ts), [operator CLI](../backend/src/cli/backfill-features.ts), [worker](../backend/src/worker/main.ts), [Prisma model](../backend/prisma/schema.prisma), [database tests](../backend/src/infrastructure/storage/postgres.test.ts), [matching tests](../backend/src/application/resume/match-jobs.test.ts).

Dedicated `jobbely_test_*` tests verify concurrent/idempotent writes, hash invalidation, stale-input rejection and ingestion/projection races. Default tests skip PostgreSQL without `TEST_DATABASE_URL`; skipping proves nothing about database correctness. A synthetic 25,000-feature ranking test exercises bounded scanning; production p95/concurrency and query-plan measurements remain pending. The shared publication lock favors correctness over high write concurrency.
