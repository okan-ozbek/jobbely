# Decision: automatic coverage verification

**Status:** Implemented 6 October 2026, Europe/Amsterdam. Technical verification runs automatically; access/display conclusions remain a separate signal.

## Rationale

The coverage checkmark must not require editing review flags, running an activation command or restarting services after each passing audit. The wave worker automatically assesses the exact imported snapshots and publishes a company result in PostgreSQL. The public API reads it on each request. Configuration-bound evidence and exact posting identities establish technical coverage of the configured hiring channels; a connected feed or matching counts alone do not.

This supersedes the manual activation requirement for the public coverage badge in [SOURCES.md](SOURCES.md). The legacy [AUDITING.md](AUDITING.md) activation path remains for stronger access-reviewed publication/removal policies. Technical verification never invents those approvals or changes registry flags.

## Automatic checks

- Every configured board must have a successful imported run and captured extraction.
- Official employer pages must identify the boards; all discovered provider boards must be configured or explicitly excluded in the existing channel configuration.
- Official posting IDs and imported posting IDs must reconcile in both directions. Existing explicit provider-native location-variant rules remain supported.
- Provider traversal must be complete, IDs unique, descriptions readable and employer/application links valid.
- Official listing pages must contain posting identities or a configured explicit empty-state marker. A JavaScript shell does not establish an empty inventory.
- Follow newly discovered same-origin pagination automatically, up to 50 total pages within the existing four-minute official-fetch budget. Interactive controls, unsupported destinations, failed pages or traversal limits withhold verification. Common location/function/search query filters cannot establish unfiltered coverage.
- Initial `scope.status`, access review approval and listing-page `complete` flags do not gate technical verification. Missing source references for included/pending channels still block it. Network allowlists, robots rules and challenge rejection remain enforced.

The audit saves both its traditional report and `technicalCoverage`. Traditional review blockers remain visible in the artifacts, while the wave's audit outcome represents the technical assessment. Access documents are still fetched/hashed, but policy approval or retrieval errors are independent of inventory matching. `accessStatus` is `approved` only for a current recorded review with matching document hashes and full-description display scope; otherwise it remains `unreviewed` or `blocked`.

## Persistence and live badge

`CompanyCoverage` stores the company, audit start time and bounded public-result payload. The payload includes the configuration hash, source-to-run-ID mapping, technical result and blockers, and access-review status. An atomic monotonic upsert prevents an older late audit from replacing a newer revocation. API reads reject results whose hash does not match the current plan and source configuration.

The API exposes `verification` with status, audit time, up to ten blockers and separate access-review status. It keeps the existing overall company status contract. `healthy` shows **Coverage verified** when every latest source run is succeeded, complete, non-quarantined, at most 36 hours old, and included in a passing fresh audit. The API withdraws the checkmark for new unaudited imports, running/failed imports, mismatches, changed configuration, quarantined counts, incomplete traversal and expired/future-dated audits. It does not require an API restart to observe worker results. Partial tooltips show the first automatic blocker.

Candidate sources retain their identity and partial publication/removal restrictions. A technical checkmark does not enable absence-based job closure, alter access approvals or claim every undiscovered employer entity/channel is covered. Unconfigured employers remain disconnected. Unsupported native collectors and inaccessible/challenged official inventories remain automated failures; there is no bypass or fabricated approval. A source-specific adapter may still need implementation to resolve such failures.

Recommendation responses use the same live company coverage result for their source explanation, so a technically verified company is not still labeled as unconfirmed solely because its registry flags remain candidate. This changes presentation metadata, not resume scoring, eligibility or ordering.

The visible company directory refreshes its metadata every minute and when returning to the tab, without replacing the page with a loading skeleton or clearing filters. Background failures retain the current directory; later successful requests update the badge. Hidden pages do not poll.

## Deployment and verification

Apply the versioned migration and rebuild both images before starting the updated API and worker. Docker's migration service runs before the other backend services. No application data or PostgreSQL volumes are replaced.

```powershell
docker compose --profile ingestion up -d --build
docker compose exec ingestion-worker cat data/wave-sync/latest.json
```

Behavior tests cover verification without manual approvals, automatic pagination, interactive/filtered/empty/mismatched inventories, new boards, exact run binding, multiple boards, expiry, quarantine and live API response serialization. Isolated PostgreSQL tests cover cross-process reads, configuration invalidation and older concurrent writes after revocation. Run root `pnpm check` with the dedicated test database, and inspect real worker/API/browser results separately; synthetic passes cannot prove live employer completeness.

On 6 October 2026, final root `pnpm check` passed all 664 tests (629 backend, 35 frontend), including 28 PostgreSQL tests against the isolated `jobbely_test_accounts` database, plus formatting, boundaries, logo validation, zero-warning lint, types, contract generation and production builds. Both Docker images built; the additive migration ran successfully and the updated API/worker/frontend started with existing volumes. The previous wave job was cancelled for the deployment and the new automatic cycle restarted from A without deleting listings or audit history.

Live API checks showed Five Rings, Palantir and Reddit as `healthy` with `verification.status: verified` and unchanged candidate registry flags. Access review remained `unreviewed`. OpenAI's HTTP 403, Anthropic's unmatched official ID and other actual inventory/traversal failures retained partial status. Browser inspection confirmed Five Rings' checkmark, scoped coverage explanation and automatic audit timestamp; its screenshot is an ignored local artifact. The directory loads without errors. Full A/B/C completion, long-running recovery and mobile layout remain separate checks; no full-cohort success is claimed.

[Auditor](../backend/src/infrastructure/audits/auditor.ts), [worker audit publication](../backend/src/infrastructure/audits/wave-refresh.ts), [coverage port](../backend/src/ports/coverage.ts), [PostgreSQL storage](../backend/src/infrastructure/storage/coverage-postgres.ts), [migration](../backend/prisma/migrations/202610060001_automatic_coverage/migration.sql), [catalog policy](../backend/src/application/catalog.ts), [public schema](../backend/src/api/schemas.ts), [coverage UI](../frontend/src/components/CoverageStatus.tsx).
