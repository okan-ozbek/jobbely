# Decision: scheduled refresh independent of source verification

**Status:** Implemented following explicit application-owner authorization on 6 October 2026, Europe/Amsterdam. Updated 7 October 2026. All 67 configured source boards enabled for automatic refresh; audit approval and absence-based closure remain separate.

## Decision and rationale

The application owner authorized Cursor local import/display and requested scheduling for all sources. A refresh request should not require inventing employer scope, access approval or technical coverage. Separate `scheduled` (whether the worker attempts a refresh) from `auditStatus` (whether stronger source verification and removal policies apply). This explicit request supersedes the repository's earlier verified-only scheduling policy; it does not approve missing employer reviews or permit bypassing restricted adapters.

All 67 current sources retain `auditStatus: candidate` and now have `scheduled: true`. They cover 64 of the 78 registered companies; companies without a source cannot be refreshed. Existing access/display blocks and malformed/unavailable feeds remain actionable failed attempts. Successful candidate snapshots update observed jobs and matching features but cannot advance missing counters or close absent jobs.

Cursor alone changes from blocked access/display to the existing pending-candidate local import path after explicit local authorization, as previously done for Cohere. Employer permission and scope remain unreviewed, with no fabricated reviewer, approved policy hashes or consent. Unrelated blocked plans remain blocked.

## Runtime invariants

- Registry loading permits scheduled candidates. Verified sources still require fresh configuration-bound audit evidence at startup and repeat official reconciliation/access checks before publication.
- The Docker worker uses one exclusive A → B → C cycle requested at startup and at **00:00 and 12:00 UTC**. Automatic cycles import only scheduled sources and skip wholly disabled/unconfigured employers. Manual application/CLI wave selection still permits unscheduled candidates for investigation.
- For a company with several boards, automatic collection skips disabled boards but audits the entire configured company scope. Missing board snapshots/runs prevent a misleading complete coverage result.
- In per-source mode, dispatch checks `scheduled` regardless of candidate/verified status and then invokes the unchanged publication workflow. Startup removes disabled/orphaned cron entries. Wave mode removes per-source cron entries and ignores their old queued jobs to prevent competing traversals.
- Scheduling never changes employer approvals, technical coverage badges, native posting identities, candidate closure eligibility, removal quarantine, network allowlists or concurrency leases. Restricted adapters remain explicit failures.
- Cycles are sequential and can take hours. An overlapping startup/cron request is suppressed rather than starting duplicate work. A scheduled attempt does not promise a successful employer import or a completed cohort every twelve hours.
- Changes require API/worker restart. Keep a single scheduling policy across ingestion replicas. The public API reports the configured schedule flag alongside actual run and coverage status; it does not report scheduled sources as verified.

## Implementation and verification

[Replit](REPLIT.md) subsequently adds one scheduled candidate source with 70 imported jobs, bringing the current total to 64. [Lovable](LOVABLE.md) adds another scheduled candidate source with 80 imported jobs, bringing the current total to 65. [ElevenLabs](ELEVENLABS.md) adds another scheduled candidate source with 137 imported jobs and matched official UUIDs, bringing the current total to 66. [Runway](RUNWAY.md) adds one scheduled candidate source with 45 imported jobs and 44 native compensation sections on 7 October local time, bringing the current total to 67. Its official ATS IDs match, while Studios/Talent Network channels keep coverage partial. The initial all-source verification below records the earlier 63-source deployment.

Behavior tests cover scheduled-candidate startup validation, automatic disabled-source exclusion, mixed-board audit gaps, manual unscheduled investigation and preservation of candidate absence counters. Existing blocked-publication and verified-evidence tests remain required. Isolated PostgreSQL queue tests cover persisted UTC cadence and cross-client overlap suppression.

Final root `pnpm check` passed formatting, dependency boundaries, logos, zero-warning lint, strict types, contracts, both builds and 761 tests (726 backend and 35 frontend). Its default environment skipped 28 PostgreSQL tests; a separate final run against the existing isolated `jobbely_test_docker` database passed all 754 backend tests, including those 28. Worker dispatch tests also prove enabled candidates run, disabled queued sources are rejected, failed imports do not backfill, and wave mode discards competing per-source jobs.

The rebuilt local API and ingestion worker restarted healthy. PostgreSQL inspection confirmed one persisted `sync-waves` schedule at `0 */12 * * *`, UTC, with no competing `sync-source` cron entries. API/CORS checks through `http://localhost:8080` confirmed all 63 source flags enabled across 60 configured companies, candidate audit status preserved, 132 Cursor jobs with complete descriptions/native application links and the existing 130 Perplexity jobs available. Cursor remains technically partial with access unreviewed. No actual Firefox UI session was exercised.

The existing exclusive wave cycle was awaiting its configured retry at 18:10:41 UTC on 6 October after worker restart; the startup request did not create a competing cycle. Scheduling and queue readiness were verified, rather than claiming a fresh successful full-cohort run. Some native/enterprise traversals take hours and existing restricted/feed failures remain unresolved.

Cursor run `c525421c-bf55-4fb5-b613-29d448cf1274` imported 132 jobs at 17:45:40 UTC, with 132 matching features and one successful aggregate snapshot. All descriptions, native IDs, original application URLs, labels, locations and publication dates were compared with the exact database snapshot. The shortest description has 434 characters. The exact-run audit remains technically partial because native title-slug links lack a validated visible-link UUID mapping; employer scope/access/display review remains pending. See [ANYSPHERE.md](ANYSPHERE.md).

- [Source configuration](../backend/config/sources.json), [registry validation](../backend/src/infrastructure/registry.ts), [registry tests](../backend/src/infrastructure/registry.test.ts).
- [Worker](../backend/src/worker/main.ts), [wave workflow](../backend/src/application/refresh-waves.ts), [selection tests](../backend/src/application/refresh-waves.test.ts), [queue settings](../backend/src/infrastructure/wave-queue.ts), [PostgreSQL queue tests](../backend/src/infrastructure/wave-queue.test.ts).
- [Worker dispatch and schedule cleanup tests](../backend/src/worker/main.test.ts).
- [Publication validation](../backend/src/infrastructure/audits/validation.ts), [snapshot lifecycle](../backend/src/infrastructure/storage/snapshot.ts), [sync tests](../backend/src/application/sync-source.test.ts), [source policies](SOURCES.md), [audits](AUDITING.md), [ingestion](INGESTION.md), [wave refresh](WAVE_REFRESH.md).
