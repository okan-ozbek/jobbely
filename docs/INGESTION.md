# Ingestion and scheduling

**Status:** Shared company queue implemented 15 October 2026. One worker runs one company at a time; replicas claim different companies. This supersedes sequential whole-cycle collection. Financial ranking and fixed lanes are not used.

## Load sharing and order

[refresh-order.json](../backend/config/refresh-order.json) defines priority. Duplicate/unknown slugs fail startup; unlisted companies append alphabetically. Cohort metadata does not control selection. Each cycle atomically inserts one public task per enabled company, with descending priority and deterministic cycle/company IDs. Free workers claim the next task. Faster workers handle more companies instead of waiting on a fixed slice's slowest import; equal company counts would not guarantee equal elapsed work.

Each worker imports a company's scheduled boards sequentially and audits every configured board using exact successful snapshots. Disabled/failed boards stay coverage gaps. Company singleton jobs and source leases prevent concurrent duplicate imports. Expected source/audit failures yield issue reports and do not block unrelated companies. Infrastructure failures retry that company, preserving completed siblings.

One exclusive coordinator holds the cycle open while companies run. Startup, manual requests and 00:00/12:00 UTC cron use the same durable queue (legacy internal name `sync-waves`). Retrying an interrupted coordinator finds existing children instead of redispatching. It aggregates outcomes and performs the final public-feature backfill. Independent 15-minute catch-up backfill remains active. Startup retires legacy per-source schedules/jobs.

## Start, scale and inspect

```powershell
docker compose stop ingestion-worker
docker compose --profile ingestion up -d --build --scale ingestion-worker=4 ingestion-worker
# Change the replica count later:
docker compose --profile ingestion up -d --scale ingestion-worker=2 ingestion-worker
docker compose logs --tail 50 -f ingestion-worker
docker compose exec --index 1 ingestion-worker cat data/source-sync/latest.json
```

Replicas use identical images/registries, PostgreSQL and the shared `ingestion-data` volume. Stop older versions before upgrading. Drain the active cycle before changing registry/order configuration, then restart all replicas; a public configuration hash rejects mismatched company workers. Scaling within one configuration is safe. The API/`pnpm dev` do not start ingestion. `INGESTION_WAVE_SYNC` is retired.

```powershell
pnpm sync:refresh                                      # enqueue a shared cycle
pnpm --filter @jobbely/backend worker                  # one host replica; repeat in another terminal
pnpm sync --company openai                             # targeted foreground import
pnpm sync --all-enabled                                # foreground ordered imports
pnpm --filter @jobbely/backend audit --company openai   # standalone audit
```

View/query PostgreSQL through the optional [database browser](DOCKER.md#database-browser). Queue tasks are in `pgboss.job`:

```sql
SELECT data->>'companySlug' AS company, state, priority, started_on, completed_on
FROM pgboss.job
WHERE name = 'sync-company'
ORDER BY created_on DESC, priority DESC;
```

## Budgets, failures and evidence

PostgreSQL-wired imports/audits share [host pacing](HTTP.md) across replicas, including body consumption, robots delays and long Retry-After cooldowns. Different hosts proceed independently. Adding workers does not multiply a provider host's allowance. Connection loss fails closed; no database transaction spans external network waits.

[SyncSource](../backend/src/application/sync-source.ts) preserves source leases/renewal, complete extraction, validation, sanitization, classification and atomic publication. Retain [audit/access gates](AUDITING.md), [transactions](STORAGE.md), [closure/quarantine](LIFECYCLE.md) and stable IDs. Candidates cannot close absent jobs or establish complete employer coverage. Leases renew every minute with a 30-minute crash expiry. Company jobs have a four-hour lifetime, 60-second heartbeat and two infrastructure retries after 60 seconds. The coordinator retains its 24-hour lifetime and one retry after 30 minutes. Provider traversal budgets remain active; complete imports can take hours.

Coordinator interruption does not erase children: queued jobs remain durable and may finish while the coordinator retries. An interrupted company restarts that company's idempotent import; traversal checkpoints are not implemented. Permanently failed children yield a cycle with issues.

Ignored `data/source-sync/` holds aggregate `<cycle-id>.json`/`latest.json`, per-task `<company-job-id>.json`, and audit artifacts under `<company-job-id>/<company>/`. Only the coordinator writes `latest.json`; company files are independent and temporary filenames unique. Old `wave-sync/` evidence remains untouched. Queues, pacing rows and reports contain public source metadata only; no candidate profiles. Retention remains unimplemented.

## Code and verification

[Coordinator](../backend/src/infrastructure/company-refresh-queue.ts), [company workflow](../backend/src/application/refresh-sources.ts), [queues](../backend/src/infrastructure/source-queue.ts), [worker](../backend/src/worker/main.ts), [reports/audits](../backend/src/infrastructure/audits/source-refresh.ts), [host budget](../backend/src/infrastructure/host-budget.ts).

Dedicated PostgreSQL tests cover two consumers, simultaneous different-company work, same-company exclusion, interruption/resume without redispatch, exclusive cycles, shared-host spacing, independent hosts, failure release and Retry-After cooldowns. Existing source lifecycle/audit/publication tests remain required. Live worker/queue observations prove rollout only; full-cohort success and production capacity require actual run evidence.

Local rollout on 15 October rebuilt the image, applied the pacing migration and started four replicas. An existing delayed coordinator retry was brought forward through pg-boss without changing its ID or overlap policy. PostgreSQL and Adminer both showed four distinct active company jobs, with queued companies remaining and no duplicate active company claims. `pnpm check` and the PostgreSQL-enabled backend suite passed. The full collection cycle remains in progress; restricted feeds retain explicit failures.
