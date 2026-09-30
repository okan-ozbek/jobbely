# Decision: application-owned ingestion

**Status:** Manual ingestion implemented; scheduled-worker implementation awaits operational validation. Recorded 30 September 2026.

## Decision and rationale

`SyncSource` owns a source refresh. API requests read previously stored jobs; refreshes run through an operator CLI or a separate worker process. This keeps upstream latency and failures outside interactive requests and makes failure behavior reusable across entry points.

```mermaid
flowchart LR
  Trigger[CLI / worker] --> Lease[Claim source lease]
  Lease --> Extract[Provider adapter validates and enumerates]
  Extract --> Prepare[Sanitize HTML and classify]
  Prepare --> Commit[Atomic snapshot publication]
  Extract -. failure .-> Fail[Record failed run]
  Prepare -. failure .-> Fail
  Commit -. failure .-> Fail
```

After claiming the lease, the use case selects the adapter, rejects duplicate IDs, prepares HTML/text, rejects empty descriptions, classifies each posting and hashes the normalized content. The repository publishes postings, evidence, versions and successful run state together. Any extraction/preparation/publication exception records failure and is rethrown. A lease conflict fails before another run is created.

## Commands and scheduling

From the repository root:

```sh
pnpm --filter @jobbely/backend run sync --company openai
pnpm --filter @jobbely/backend run sync --all-enabled
pnpm --filter @jobbely/backend run worker
```

Manual sync requires PostgreSQL mode. `--company` includes configured candidate boards for evaluation; `--all-enabled` selects scheduled sources. One company may have multiple boards, synchronized separately. The CLI continues after a source error and exits unsuccessfully if any source failed.

The worker uses pg-boss in the same PostgreSQL database, with local concurrency one, keyed source schedules, UTC refreshes at staggered minutes every 12 hours, and a configured two retries with backoff. It rechecks audit/enabled state before processing a job. The source lease is the cross-process overlap guard; local concurrency alone is not.

## Invariants, tradeoffs and limits

Failed runs never reconcile removals or publish partial updates. Last successful listings remain readable. Quarantine affects removal reconciliation; valid observed postings still update. Successful snapshots retain raw evidence; failed runs currently retain an error summary rather than their fetched payloads.

All candidate sources are currently unscheduled. Queue restart/retry behavior, schedule removal when disabling a source, and long-running lease renewal need operational verification or implementation. Registry changes require process restart. The worker is not started by `pnpm dev` or the API entry point. SIGINT/SIGTERM trigger queue shutdown and repository closure.

## Implementation and verification

[Use case](../backend/src/application/sync-source.ts), [behavior tests](../backend/src/application/sync-source.test.ts), [CLI](../backend/src/cli/sync.ts), [worker](../backend/src/worker/main.ts). Publication and expiry belong to [STORAGE.md](STORAGE.md); closure belongs to [LIFECYCLE.md](LIFECYCLE.md).
