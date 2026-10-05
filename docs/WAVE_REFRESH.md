# Decision: ordered wave refresh with automatic audits

**Status:** Implemented 6 October 2026, Europe/Amsterdam. Automated collection and audit execution; source activation and unresolved scope/access decisions remain separate.

## Choice and rationale

Run one durable cycle in the order Wave A → Wave B → Wave C. Within each wave, process employers and each configured board sequentially, audit each employer using its successful imported snapshots, then update matching features before advancing to the next wave. The workflow automates invoking and recording the audit; an operator no longer needs to run separate sync and audit commands for each cohort.

The Docker ingestion worker opts into automatic cohort refresh with `INGESTION_WAVE_SYNC=true`. This is the user's explicitly requested automation of the same configured candidate-board imports previously available through wave CLI commands. Candidate snapshots remain partial/investigative and cannot close missing jobs. Individual source `scheduled` flags and `auditStatus` remain unchanged; a successful feed fetch does not establish employer-wide coverage or justify marking a pending review approved.

## Cycle and failure behavior

1. Claim an exclusive `sync-waves` PostgreSQL queue job. Startup requests a cycle; cron requests another at 00:00 and 12:00 UTC. Manual requests use the same queue. Only one job may be queued or active across clients; busy cycles suppress additional requests rather than building a backlog.
2. Persist a running progress report before network work. Resolve companies by registry wave membership, preserving source IDs. Unconfigured companies appear as blocked rather than disappearing from the report.
3. Synchronize each configured source through the existing adapter, lease, sanitization/classification and atomic snapshot workflow. Verified sources retain the existing pre-publication reconciliation gate. Candidate collection retains the existing lifecycle restrictions. Per-source failures preserve previous listings and do not prevent later sources/waves from running.
4. Automatically audit each employer against official inventories, posting IDs, board links, traversal, robots/policy hashes, details and existing scope/access decisions. Reuse the exact successful extraction through `SyncSource.executeWithEvidence`; never perform another full enterprise feed traversal for the post-sync audit. Failed sources have explicit missing-snapshot errors rather than being fetched a second time or treated as zero-job inventories.
5. Save company audit reports and fetched official-page evidence. Successful raw feed evidence is already persisted with the source's database run. An audit blocker remains distinct from a source import failure; report `passed`, `blocked` or `failed` separately.
6. Backfill public matching features after each wave. Projection errors are recorded and later waves still run. Finish as `succeeded` or `completed_with_issues`; infrastructure/cancellation errors mark the cycle `failed`.

An audit executes automatically even for pending plans, but cannot fabricate official inventory completeness, employer channels, approved display conditions or permissions to access restricted sites. Existing [audit gates](AUDITING.md) remain effective. The workflow does not auto-edit registry verification flags, approve reviews, overwrite activation evidence or automatically close jobs from unverified boards. New source integrations/collectors remain necessary where an official inventory cannot be enumerated. Restricted adapters remain explicit failures.

## Queue, cancellation and persistence

The `exclusive` pg-boss policy provides cross-client overlap prevention. Source leases additionally protect publication against manual per-source imports. Wave jobs have a 24-hour maximum lifetime, a 60-second heartbeat and one retry after 30 minutes for an unexpected cycle failure. Expected individual source/audit failures produce a completed report with issues; adapters already apply bounded network retries. Long Workday/native imports can take hours; if a cycle crosses a scheduled boundary, the scheduled request is suppressed. This is not a promise that every employer succeeds within twelve hours.

Queue cancellation is passed through the application workflow and checked before starting more network work and before source publication. An in-flight provider request/traversal does not yet support immediate transport cancellation, but cannot publish its snapshot after the job is aborted. Source lease/crash recovery and external network budgets retain their existing limits. A cancelled/retried cycle starts again from A; per-employer checkpoint resume is deferred, and imports remain idempotent.

Automatic wave mode unschedules legacy per-source cron entries and ignores their queued jobs to avoid parallel full-wave and per-source traversals. Host workers with wave mode disabled retain the prior verified-source scheduling behavior. Do not run differently configured ingestion replicas against the same database; they have conflicting scheduling policies.

Progress and reports live under `backend/data/wave-sync/` for host workers and `/app/backend/data/wave-sync/` in Docker:

- `latest.json`: atomic current/final progress, source run IDs/counts/errors, audit outcomes and artifact paths.
- `<queue-job-id>.json`: cycle history.
- `<queue-job-id>/<company>/report.json` and `raw-pages.json`: automatic employer audit and official evidence.

Docker persists this directory in the named `ingestion-data` volume. It is separate from `postgres-data`, excludes candidate data and is ignored by Git/build context. The image prepares it for the non-root Node user. Raw public evidence/history retention is not implemented; monitor volume growth. A progress-storage failure stops new work instead of losing the audit trail. Reports are operator artifacts, not new public API endpoints or admin UI.

## Operator commands

Start/rebuild the Docker worker:

```powershell
docker compose --profile ingestion up -d --build ingestion-worker
docker compose logs --tail 50 -f ingestion-worker
```

Request another durable cycle; overlapping requests are suppressed:

```powershell
docker compose exec api node dist/cli/sync-waves.js
```

Inspect live progress (it may show `running` for hours):

```powershell
docker compose exec ingestion-worker cat data/wave-sync/latest.json
```

For host development, set `DATA_MODE=postgres`, configure the database and start the worker with `$env:INGESTION_WAVE_SYNC = 'true'`. `pnpm sync:waves` enqueues a cycle and requires that worker to process it; it does not block the terminal on all imports. Existing `sync:wave-a/b/c`, individual-company sync and audit/activation commands remain available for targeted diagnostics.

## Implementation and verification

[Workflow](../backend/src/application/refresh-waves.ts), [ports/report model](../backend/src/ports/wave-refresh.ts), [source sync](../backend/src/application/sync-source.ts), [snapshot-reusing auditor](../backend/src/infrastructure/audits/auditor.ts), [file reports/audits](../backend/src/infrastructure/audits/wave-refresh.ts), [queue settings](../backend/src/infrastructure/wave-queue.ts), [worker](../backend/src/worker/main.ts), [enqueue CLI](../backend/src/cli/sync-waves.ts), [Compose](../compose.yaml).

Behavior tests cover A/B/C order, multi-board audit inputs, source/audit/projection failure continuation, unconfigured companies, storage failure and cancellation. Auditor tests cover exact snapshot reuse without second feed fetches and failed-source gaps. Isolated PostgreSQL tests use two pg-boss clients to prove duplicate queued/active cycles are suppressed, completion permits the next cycle and the UTC cron schedule is persisted. Root `pnpm check` and actual Docker worker/report checks are required. A passing synthetic suite does not prove live employer scope or full-cohort success; inspect the running cycle reports for actual outcomes.

On 6 October 2026, root `pnpm check` passed formatting, boundaries, logos, zero-warning lint, strict types, contracts, builds and all 646 tests (611 backend, 35 frontend), including 26 PostgreSQL tests against the isolated test database. The updated backend image built, migrations completed, and the API and ingestion containers started successfully using the existing PostgreSQL volume. The running worker wrote progress and audit artifacts to its new persistent volume. A second enqueue request correctly reported an existing queued/running cycle without starting another.

The first live cycle imported OpenAI (822 listings), Anthropic (643), both Radix boards (8 and 7), Five Rings (17), Headlands (8) and Figma (164), then continued to Discord. Their automatic audits recorded existing pending scope/access reviews and actual official-inventory/access blockers; none was silently marked verified. By the final progress check, Wave A had completed 13 source imports and 10 company audits, and the worker had advanced to Wave B's AMD import. The full cycle was still running. Frontend and versioned Companies API requests returned HTTP 200, and internal API database readiness returned 200. These observations prove startup, imports, audit execution, persistence, wave advancement and overlap suppression; full A/B/C completion and unattended crash recovery remain unverified.
