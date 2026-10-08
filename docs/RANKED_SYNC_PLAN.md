# Plan: ranked companies and parallel round-robin sync

**Status:** Proposed, 8 October 2026 (Europe/Amsterdam), with a source-scoped publication prerequisite implemented alongside the first [resume performance increment](RESUME_PERFORMANCE_PLAN.md#implementation-progress-8-october). Scheduling and financial ranking have not changed; four-worker deployment remains pending.

**Owner request:** Replace waves with four parallel workers. Use financial company size initially, then allow observed user popularity to become the priority input.

## Outcome and current evidence

Replace cohort barriers with independently progressing company tasks. Ranking decides assignment and initial priority; it does not decide access permission, coverage, recommendation fit or source activation.

The current [worker](../backend/src/worker/main.ts) consumes one exclusive `sync-waves` job with local concurrency one. [RefreshWaves](../backend/src/application/refresh-waves.ts) traverses A, B and C sequentially, synchronizes each company's boards, audits the company, and backfills after each wave. Runtime companies accept A–D, but the automatic traversal omits D. The [500-company backlog](TECH_COMPANIES_500.json) explicitly identifies its numbers as discovery row numbers, not financial ranks. Renaming these numbers would fabricate a ranking.

Initial local inspection on 8 October found 81 registered companies, 70 scheduled sources and an exited ingestion container using an older backend image. Its final log recorded a database-connectivity startup failure; PostgreSQL was healthy. The newest successful run finished at `2026-10-07T01:03:14.371Z`. All 70 sources failed matching's 36-hour freshness checks at inspection. This was an operational recovery prerequisite, not evidence that every adapter was broken. The planning change performed no imports.

In the subsequent implementation turn, the owner approved restarting ingestion with the rebuilt image. An existing delayed retry was brought forward through pg-boss without creating a competing cycle. Thirteen fresh sources and Wave A feature backfill were observed before the worker advanced to NVIDIA in B; full-cycle recovery remains unverified. [Resume performance progress](RESUME_PERFORMANCE_PLAN.md#implementation-progress-8-october) records the tests, local deployment and recovered PDF flow. Wave scheduling itself is still unchanged.

Implemented scheduling and gates remain owned by [SCHEDULING](SCHEDULING.md), [WAVE_REFRESH](WAVE_REFRESH.md), [INGESTION](INGESTION.md), [SOURCES](SOURCES.md), [AUDITING](AUDITING.md) and [STORAGE](STORAGE.md) until migration lands.

## Ranking policy and data

Use a versioned financial-size snapshot, independent of the source registry:

- Public companies: total equity market capitalization in USD at a common observation date. Record issuer identity, ticker/exchange, currency, FX evidence, value date, financial-data source and retrieval date. Consolidate multiple listings/share classes correctly; do not sum duplicate quotes for the same issuer.
- Private companies: latest publicly disclosed equity valuation, with its date and direct announcement evidence, as a **provisional size estimate**. Funding raised, revenue, headcount and enterprise value cannot silently substitute for equity value. Private valuations have different dates and liquidity conditions; the resulting combined list is a financial-size priority estimate, not a verified investment ranking.
- Missing, conflicting or stale values: mark unranked and place after ranked companies with a stable slug tie-breaker. Keep existing scheduled employers eligible even when valuation evidence is missing or they fall outside the target 500. Their freshness must not depend on completing new-employer discovery.

Define the global technology employer universe before selecting the 500: software/cloud/AI, semiconductors/hardware, technology platforms and explicitly reviewed technology-enabled employers. Track parent issuer separately from hiring brand. GitHub/Microsoft and Slack/Salesforce must not receive invented independent market caps or duplicate parent weights. Review existing quant, bank and gaming employers explicitly; removing waves must not silently delete their sources. Preserve stable company/source slugs throughout.

The first delivery must acquire and validate financial data for the shortlist, document coverage gaps, and produce a dated ranked snapshot. It must not label the current editorial 500 as the world's financially largest 500. A comprehensive global universe and usable data-provider licensing are still required; no provider purchase or financial dataset was configured during this review. [PwC's 2026 methodology](https://www.pwc.co.uk/audit/assets/pdf/global-100/companies/global-top-100-companies-2026.pdf) is a useful public-company reference for dated USD market capitalization, but its top 100 cannot establish our top 500 or private-company values.

Proposed ranking records contain `companySlug`, `issuerId`, `financialValueUsd`, `metricKind`, `valueAsOf`, `evidenceUrl`, `evidenceStatus`, `rank` and `rankingVersion`. A ranking strategy produces an immutable ordered snapshot. Source configuration retains source identity, adapters, schedules and audit policy. Freeze ranking, registry version and worker count per refresh cycle; financial updates take effect next cycle.

Later, a `popularity` strategy can use aggregate company views, job opens, saves or original-application clicks. Define consent, bot/deduplication controls, normalization, time decay and a minimum refresh floor before collection. Clicks indicate interest, not completed applications. Do not use resumes or individual candidate data as queue payloads. Popularity is a separate future increment linked to [ANALYTICS_PLAN](ANALYTICS_PLAN.md); it need not change worker assignment code.

## Assignment and execution

For the frozen ordered company list, use a zero-based position `i` and worker count `W`: `lane = i % W`. Include unconfigured targets as explicit skipped records before assignment; skipping work must not renumber the remaining ranks within that cycle.

| Worker slot | Companies with W = 4 |
| ----------- | -------------------- |
| 0 (A)       | 1, 5, 9, …, 497      |
| 1 (B)       | 2, 6, 10, …, 498     |
| 2 (C)       | 3, 7, 11, …, 499     |
| 3 (D)       | 4, 8, 12, …, 500     |

A–D here are worker slots only, with no connection to historical waves. Slots run concurrently, normally taking their next ranked company. There is no cross-slot completion barrier. Four workers do not guarantee fourfold speed: shared ATS host limits, slow traversals and database publication can dominate. Preserve fixed round-robin assignment initially; work stealing is a separate possible change after measuring lane imbalance.

Retain pg-boss and PostgreSQL rather than adding Redis or another queue service. Proposed durable state:

1. A coordinator creates one active cycle with its frozen assignments. A database uniqueness/locking invariant suppresses overlapping startup, cron and manual cycles until all company tasks are terminal. Dispatch completion alone does not finish a cycle.
2. Persist one task per `(cycleId, companySlug)`, plus assignment, stage, attempts, source run IDs, lease owner, timestamps and outcome. Enqueue through a transactional outbox or reconcile undispatched durable tasks after restart; a crash between saving state and sending work cannot strand companies.
3. Use four lane queues, one consumer slot each, with database-enforced single active processing per lane. A singleton queue policy is a candidate for the installed pg-boss version; **do not use the current exclusive policy for a backlog of company jobs**, because it suppresses queued work. Verify exact pinned-version semantics against two real queue clients. `localConcurrency: 1` alone is insufficient across replicas.
4. Each task imports the company's scheduled boards sequentially, then audits their exact successful extractions and run IDs. Preserve missing-board blockers. Persist a checkpoint after each successful source and audit; retries reuse retained exact evidence or explicitly rerun the required source, never claim a new extraction represents an old run. Do not place large extraction snapshots in queue JSON.
5. Expected access/provider failures become recorded terminal issues and allow the lane to continue. Transient infrastructure failures get bounded backoff and recovery. Source leases remain the publication fence; task claims/leases also prevent stale attempts changing task outcome. Cancellation stops dispatch and publication, and a resumed cycle retains completed checkpoints.
6. Publish incremental database progress. A single reporter may export `latest.json` and history from durable state. Four workers must not mutate the same in-memory report or the current shared `.tmp` filenames in [FileWaveRefreshReports](../backend/src/infrastructure/audits/wave-refresh.ts). Keep existing audit artifacts readable and preserve evidence retention boundaries.

Start with the current startup and 00:00/12:00 UTC trigger semantics, with catch-up reconciliation on recovery. Measure whether all scheduled companies can actually refresh within the 36-hour recommendation window. If not, introduce per-company due times/age priority within assigned lanes and revisit resource limits; do not relax eligibility to hide lag. A ranking strategy must not starve smaller employers.

## Parallelism constraints

- Both public-feed and official-audit request limits must be shared across processes by hostname. [PublicJsonTransport](../backend/src/infrastructure/http.ts) currently serializes requests and tracks its one-second spacing **in process memory**. Four independent containers would multiply that allowance. Add a distributed host reservation/lease behind the transport boundary, retaining robots crawl delays, Retry-After, allowlists, redirect/DNS checks and adapter time/size limits. Database locks must not stay open during network waits.
- [commitSnapshot](../backend/src/infrastructure/storage/postgres.ts) retains global publication lock 721049. The first performance increment now scopes reads to the source's postings and run history, preserving pure lifecycle policy and atomic dataset increments. Reading only the current run/latest valid baseline is still a possible refinement. Four collectors will still serialize publication; keep the global lock until measured lock time justifies a separately verified concurrency redesign.
- Enrichment remains an independent public workflow. Replace wave-end whole-dataset backfills with deduplicated changed-posting/source work and a bounded catch-up sweeper. Limit enrichment CPU and database connections separately from the four collectors. Preserve hash/version compare-and-publish and shared lock ordering in [JOB_FEATURES](JOB_FEATURES.md).
- Queue data and logs contain public source metadata only. Scheduling still cannot approve blocked access, establish complete coverage or close jobs from candidate snapshots.

## Delivery sequence and acceptance

| Phase | Work                                                                                                                                | Acceptance                                                                                                                    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 0     | Diagnose/recover the stopped worker using the current image and database readiness; record real run/feature freshness and failures. | Worker heartbeat and actual source outcomes visible; no fabricated coverage or freshness.                                     |
| 1     | Implement financial snapshot validation, issuer mapping and pure ranking/round-robin functions.                                     | Deterministic 1…500 assignment, ties/missing values/parents handled; existing sources retained.                               |
| 2     | Add durable cycles/tasks, recoverable dispatch, four consumers and cross-process host budgets.                                      | Concurrent independent lanes; two clients cannot duplicate a lane/source publication; crash recovery resumes unfinished work. |
| 3     | Scope publication reads, checkpoint evidence and incremental enrichment; benchmark with phase 2.                                    | Stable posting IDs, identical lifecycle outcomes, bounded lock time/memory and no full-corpus backfill per company.           |
| 4     | Retire waves and switch Compose scheduling atomically after a staged trial.                                                         | No mixed old/new schedulers, orphan queues or omitted D companies; operator reports show financial rank and worker slot.      |

At phase 4, update [model](../backend/src/domain/model.ts), registry validation/configuration, [bootstrap](../backend/src/bootstrap.ts), worker, CLI selectors/scripts, audit selection, report ports, tests, configuration documentation and generated public contracts if company schemas change. Audit configuration hashes may depend on company metadata: inspect the hash inputs and regenerate evidence only when their underlying validated meaning changes. Historical wave documents remain dated evidence, while active guides mark the replacement. Proposed command names/configuration are not available yet.

Drain or explicitly cancel/checkpoint the old exclusive job, remove `sync-waves` and competing per-source schedules, then deploy all ingestion replicas with one scheduler policy. Preserve data volumes. Rollback requires stopping ranked consumers and clearing/reconciling claims before re-enabling the old scheduler; never run both policies together.

Verification must include unit tests for round-robin/ties/ranking changes; isolated PostgreSQL tests for competing coordinators, dispatch crash gaps, leases/fencing and retry checkpoints; four-process host-rate tests; source/audit failure and cancellation tests; mixed-board coverage tests; unchanged lifecycle and feature-publication tests. Benchmark one versus four workers on identical synthetic/replayed public snapshots, then authorized live sources, including slow and shared-host employers. Record lane completion, source freshness, imports/minute, 429s, lock wait, memory, queue age and API latency under ingestion. Target four simultaneous company tasks without exceeding shared host budgets; establish cycle-duration targets from measurements rather than promising a speed multiplier.

Implementation gates: scoped formatting, relevant tests/types, `pnpm contracts` when contracts change, final zero-warning `pnpm lint`, isolated PostgreSQL concurrency checks, and `pnpm check` before release. See [QUALITY](QUALITY.md).

## Research and relationship to the second plan

The maintained [pg-boss documentation](https://pgboss.io/) explains its PostgreSQL queue foundation, and [queue policies](https://github.com/timgit/pg-boss/blob/master/docs/api/queues.md) distinguish singleton from exclusive behavior. Online master documentation may include features newer than our installed v12; no dependency upgrade is assumed. Consult pinned package types/tests before implementation.

[RESUME_PERFORMANCE_PLAN](RESUME_PERFORMANCE_PLAN.md) owns interactive query/matching optimization. Recover freshness and reduce API full-snapshot reads before enabling larger ingestion concurrency; otherwise four workers can make an already memory-heavy API workload worse. This proposal does not alter implemented source, privacy or matching decisions.
