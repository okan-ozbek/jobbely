# Decision: PostgreSQL repository and atomic publication

**Status:** Implemented and integration-tested for the first slice, 30 September 2026.

## Decision and rationale

Use PostgreSQL with Prisma's PostgreSQL adapter, behind `JobRepository`. A separate memory implementation supports deterministic tests and an explicitly labeled demo. Persistent mode requires a working database and never silently changes to demo mode.

The repository is a port for application behavior, not a generic CRUD framework. Its unit of work, `commitSnapshot`, ensures readers cannot observe a half-published refresh. Domain lifecycle rules are reused by both implementations through `applySnapshot`.

Wave C replaces sequential row writes with bounded batches: 250 postings per parameterized JSON upsert, 250 version records per `createMany`, and ten raw snapshots per `createMany`. Every batch remains inside the same transaction and the existing 60-second transaction timeout. The shared dataset/source locks, lease check, stable identities, lifecycle policy and version publication remain atomic. Separate PostgreSQL tests cross batch boundaries and verify rollback after evidence failure. This reduces round trips for Amazon's large inventory; it does not change API query scaling. See [WAVE_C.md](WAVE_C.md).

## Records and evidence

The 6 October [automatic coverage](AUTOMATIC_COVERAGE.md) increment adds `CompanyCoverage`: current configuration-bound technical evidence and source run IDs shared by API/worker clients. Monotonic atomic upserts prevent older audits overwriting newer outcomes. This is public job-source metadata, not candidate/account data, and does not replace source registry or lifecycle records.

Resume matching adds a public `JobFeature` projection and feature-generation counter. Hash/version joins invalidate changed postings immediately; bounded backfill publishes under the shared ingestion lock. Candidate profiles are never stored. Indexes, transaction/race rules and commands are documented in [JOB_FEATURES](JOB_FEATURES.md).

| Record           | Purpose                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `Posting`        | Current normalized job plus compact catalog metadata; unique `(sourceId, sourcePostingId)` |
| `PostingVersion` | Full normalized content when a posting is new or its content hash changes                  |
| `Run`            | Running/succeeded/failed observation and traversal/removal evidence                        |
| `Snapshot`       | Successful run's raw provider JSON, source URL and fetch time                              |
| `SourceLease`    | Current owner and 30-minute expiry for one source                                          |
| `DatasetVersion` | Shared publication version used by pagination cursors                                      |

JSON payloads preserve rich canonical records/evidence; selected typed columns enforce identity and support future indexing. Content history does not currently record every unchanged refresh or every lifecycle-only transition. Companies/sources are configuration files, not database tables. pg-boss owns its queue schema separately.

The [8 October metadata migration](../backend/prisma/migrations/202610080001_catalog_metadata/migration.sql) stores `locations`, `workplace` and the original ISO `lastSeenAt` string outside the large JSON payload. It backfills existing rows transactionally and derives the fields from canonical JSON in a database trigger on every insert/update, including writes from older workers. Direct metadata writes cannot make these fields disagree with the payload. No observation timestamp is advanced, and posting IDs, content hashes and dataset versions retain their meaning. Unfiltered/location-facet queries can read this small projection without unpacking every description. Substring search still needs description/department JSON.

GET snapshots retain the legacy raw-response payload. POST snapshots use `{ format: "http-exchange-v1", request, body }` so Workday offsets and facet filters are retained with the exact JSON response. Their URL and fetch timestamp remain separate columns. Older snapshots predate request-body capture; readers must distinguish the envelope from an unwrapped provider response.

## Transaction and lease rules

`startRun` takes a source advisory lock and grants one unexpired lease across clients. The next claimant after expiry marks the abandoned running record failed and replaces its lease. During long imports, `renewRun` atomically extends only the same run's still-unexpired lease by 30 minutes. `SyncSource` requests renewal every minute; crashes still expire naturally, and a stale worker cannot renew an expired or replaced owner. There is no periodic cleanup daemon.

`commitSnapshot` takes the shared publication lock followed by the source lock, verifies owner/expiry, applies the snapshot, and writes postings, changed versions, raw evidence, run state, dataset version and lease release in one transaction. Its transaction timeout is 60 seconds. Failed publication rolls everything back. `failRun` rechecks ownership/status under the source lock and removes only that run's lease.

Catalog reads use repeatable-read transactions for a consistent dataset. The 8 October query increment adds [CatalogLookups](../backend/src/ports/catalog.ts): coverage reads aggregate active counts and at most two run records per source (latest run and latest successful exhaustive run); detail uses a primary-key lookup. Catalog search filters active/company/category/workplace and literal substring predicates in SQL and returns only location/order metadata. The application retains location interpretation, sorting and cursors, then reads the selected page's payloads with a dataset-version check. A revision change between metadata and page retrieval returns `cursor_stale`, rather than mixing revisions. Empty matching results request no company coverage.

Publication now reads postings and run history only for the source being committed, together with the shared dataset version. The pure lifecycle transition, global/source lock order, lease fence, atomic writes and rollback remain unchanged. Publications still serialize globally to protect the shared version; this favors simple correctness over high write throughput.

## Limits and extension points

The legacy full `read()` remains available for bulk workflows. Catalog metadata still scales with the number of matching rows; location filtering, facets and sorting run in the application, and substring search reads description JSON inside PostgreSQL. Indexed search, normalized location tokens, SQL pagination and compact public summaries remain follow-ups in [RESUME_PERFORMANCE_PLAN](RESUME_PERFORMANCE_PLAN.md). Source publication still reads that source's complete run history. Retention for snapshots, runs and history is not implemented.

Use versioned migrations for schema changes and preserve source identity across deployments. Never migrate the real application database as part of an integration test.

## Implementation and verification

[Schema](../backend/prisma/schema.prisma), [migrations](../backend/prisma/migrations/), [port](../backend/src/ports/ingestion.ts), [PostgreSQL repository](../backend/src/infrastructure/storage/postgres.ts), [snapshot transition](../backend/src/infrastructure/storage/snapshot.ts), [memory repository](../backend/src/infrastructure/storage/memory.ts).

[Integration tests](../backend/src/infrastructure/storage/postgres.test.ts) cover independent-client exclusion, ownership/expiry-safe renewal, duplicate rejection, stable missing/reappearing identity, and rollback after a posting write when evidence persistence fails. The query increment adds PostgreSQL/memory predicate parity (including literal `%`/`_`, accents, departments and multiple locations), bounded coverage history, revision drift and preservation of another source's postings. API tests reject any full repository read while serving coverage, facets, a page and a detail. See [QUALITY.md](QUALITY.md).
