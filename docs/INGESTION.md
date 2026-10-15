# Ingestion and scheduling

**Status:** One ordered refresh implemented 15 October 2026. This replaces wave and per-source scheduling. Financial ranking and parallel lanes are not implemented.

## Order and operation

Edit [refresh-order.json](../backend/config/refresh-order.json) to change company priority: first slug runs first. Duplicate/unknown slugs fail startup. Unlisted companies append alphabetically, so a newly configured source cannot silently disappear. Boards within a company follow [sources.json](../backend/config/sources.json) order. Restart the worker after configuration edits. Historical `Company.wave` values remain compatibility metadata; they control neither scheduling nor CLI selection.

One exclusive pg-boss cycle processes scheduled sources one by one, audits each company using its exact successful snapshots, then backfills public matching features once at cycle end. An independent 15-minute catch-up backfill keeps features moving during long imports. No barrier or backfill separates company cohorts. Automatic runs skip companies without scheduled sources; an audit still checks every configured board of a selected company, including disabled/failed boards, so missing evidence stays a coverage gap.

The worker requests a cycle at startup and at 00:00/12:00 UTC. Manual requests use the same exclusive queue; overlapping requests are suppressed globally. The durable queue retains its old internal name `sync-waves` so existing delayed retries and exclusivity survive upgrades; every new worker executes the ordered source workflow. Stop all older worker versions before deploying this version. Startup removes legacy `sync-source` schedules and drains their queued work without fetching.

```powershell
pnpm sync:refresh                                      # enqueue an ordered cycle
pnpm --filter @jobbely/backend worker                  # host worker; PostgreSQL required
pnpm sync --company openai                             # targeted manual import
pnpm sync --all-enabled                                # ordered scheduled-source imports
pnpm --filter @jobbely/backend audit --company openai   # targeted audit, no publication
pnpm --filter @jobbely/backend audit --all-enabled
```

For Docker:

```powershell
docker compose stop ingestion-worker
docker compose --profile ingestion up -d --build ingestion-worker
docker compose exec ingestion-worker cat data/source-sync/latest.json
docker compose logs --tail 50 -f ingestion-worker
```

The API and `pnpm dev` do not start ingestion. `INGESTION_WAVE_SYNC` is retired; there is one scheduling policy. Registration alone does not configure a working source. Scheduling candidates is authorized independently of audit approval; restricted sources still fail explicitly.

## Publication and failures

[SyncSource](../backend/src/application/sync-source.ts) claims a source lease, extracts and validates every posting, prepares HTML, classifies, then publishes atomically. Per-source failures preserve prior data and continue to later companies. Company audit failures and final projection failures are reported separately as `completed_with_issues`. Progress-storage failures and cancellation stop the cycle. The signal is checked before subsequent work and publication; an in-flight transport request may finish before cancellation takes effect.

Keep source/posting identities, exact evidence, [access/audit gates](AUDITING.md), [network limits](HTTP.md), [lease fencing and transactions](STORAGE.md), and [closure/quarantine rules](LIFECYCLE.md). Scheduled candidate imports cannot close absent jobs. A successful feed is not complete employer coverage. Source leases renew every minute with a 30-minute crash expiry. Queue jobs have a 24-hour lifetime, 60-second heartbeat, and one unexpected-failure retry after 30 minutes. Slow full-detail imports can take hours; a twelve-hour schedule is not a completion guarantee.

Progress and audit artifacts live in ignored `backend/data/source-sync/` (Docker: persistent `ingestion-data` volume): `latest.json`, `<job-id>.json`, and `<job-id>/<company>/report.json` plus `raw-pages.json`. Old `wave-sync/` reports remain untouched historical artifacts. No candidate data enters these queues/reports. Retention and checkpoint resume are not implemented: a retry starts the ordered list again, using idempotent publication.

## Code and verification

[Workflow](../backend/src/application/refresh-sources.ts), [report/ports](../backend/src/ports/source-refresh.ts), [audits](../backend/src/infrastructure/audits/source-refresh.ts), [queue](../backend/src/infrastructure/source-queue.ts), [worker](../backend/src/worker/main.ts), [enqueue CLI](../backend/src/cli/refresh-sources.ts), [order policy](../backend/src/domain/source-order.ts).

Tests cover manual order, former D membership, multi-board evidence reuse, disabled-board audit gaps, failure continuation, cancellation, progress failure, retired schedule draining, and cross-client queue exclusivity against dedicated PostgreSQL. Provider health and full-cycle success require actual run reports; a test pass does not certify employer scope.

Local rollout on 15 October rebuilt and started the Docker worker. PostgreSQL showed one active exclusive cycle, one twice-daily UTC refresh schedule, the independent 15-minute feature backfill, and no per-source schedules. The worker wrote `source-sync` progress and advanced through consecutive companies. Full-cohort completion and unattended recovery remain unverified; existing restricted feeds still report their blockers.
