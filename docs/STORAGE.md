# Decision: PostgreSQL repository and atomic publication

**Status:** Implemented and integration-tested for the first slice, 30 September 2026.

## Decision and rationale

Use PostgreSQL with Prisma's PostgreSQL adapter, behind `JobRepository`. A separate memory implementation supports deterministic tests and an explicitly labeled demo. Persistent mode requires a working database and never silently changes to demo mode.

The repository is a port for application behavior, not a generic CRUD framework. Its unit of work, `commitSnapshot`, ensures readers cannot observe a half-published refresh. Domain lifecycle rules are reused by both implementations through `applySnapshot`.

## Records and evidence

| Record           | Purpose                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| `Posting`        | Current normalized job plus query metadata; unique `(sourceId, sourcePostingId)` |
| `PostingVersion` | Full normalized content when a posting is new or its content hash changes        |
| `Run`            | Running/succeeded/failed observation and traversal/removal evidence              |
| `Snapshot`       | Successful run's raw provider JSON, source URL and fetch time                    |
| `SourceLease`    | Current owner and 30-minute expiry for one source                                |
| `DatasetVersion` | Shared publication version used by pagination cursors                            |

JSON payloads preserve rich canonical records/evidence; selected typed columns enforce identity and support future indexing. Content history does not currently record every unchanged refresh or every lifecycle-only transition. Companies/sources are configuration files, not database tables. pg-boss owns its queue schema separately.

GET snapshots retain the legacy raw-response payload. POST snapshots use `{ format: "http-exchange-v1", request, body }` so Workday offsets and facet filters are retained with the exact JSON response. Their URL and fetch timestamp remain separate columns. Older snapshots predate request-body capture; readers must distinguish the envelope from an unwrapped provider response.

## Transaction and lease rules

`startRun` takes a source advisory lock and grants one unexpired lease across clients. The next claimant after expiry marks the abandoned running record failed and replaces its lease. During long imports, `renewRun` atomically extends only the same run's still-unexpired lease by 30 minutes. `SyncSource` requests renewal every minute; crashes still expire naturally, and a stale worker cannot renew an expired or replaced owner. There is no periodic cleanup daemon.

`commitSnapshot` takes the shared publication lock followed by the source lock, verifies owner/expiry, applies the snapshot, and writes postings, changed versions, raw evidence, run state, dataset version and lease release in one transaction. Its transaction timeout is 60 seconds. Failed publication rolls everything back. `failRun` rechecks ownership/status under the source lock and removes only that run's lease.

Catalog reads use a repeatable-read transaction for a consistent dataset. Publications serialize globally to protect the shared version; this favors simple correctness over high write throughput.

## Limits and extension points

Reads currently load all postings/runs into memory; existing indexes do not make application-side filtering scalable. Introduce query-oriented repository methods and indexed pagination before broad ingestion. Keep JSON payloads and typed metadata consistent in migrations/backfills. Retention for snapshots, runs and history is not implemented.

Use versioned migrations for schema changes and preserve source identity across deployments. Never migrate the real application database as part of an integration test.

## Implementation and verification

[Schema](../backend/prisma/schema.prisma), [migrations](../backend/prisma/migrations/), [port](../backend/src/ports/ingestion.ts), [PostgreSQL repository](../backend/src/infrastructure/storage/postgres.ts), [snapshot transition](../backend/src/infrastructure/storage/snapshot.ts), [memory repository](../backend/src/infrastructure/storage/memory.ts).

[Integration tests](../backend/src/infrastructure/storage/postgres.test.ts) cover independent-client exclusion, ownership/expiry-safe renewal, duplicate rejection, stable missing/reappearing identity, and rollback after a posting write when evidence persistence fails. See [QUALITY.md](QUALITY.md).
