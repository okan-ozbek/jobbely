# Decision: evidence-based job lifecycle

**Status:** Implemented, 30 September 2026.

## Decision and rationale

Identify a posting by `(sourceId, sourcePostingId)` and keep its internal ID and `firstSeenAt` stable across updates and reappearance. A content hash detects normalized content changes; it is not job identity. Distinct board IDs remain distinct even if titles/descriptions match.

Absence alone is weak evidence: feeds can fail, become incomplete or lose a region. Only a successfully published, completely traversed, scope-verified source may accumulate missing observations.

## Closure rules

1. A seen posting becomes active and resets missing counters/timestamps, including when it was previously closed.
2. An absent posting on an eligible snapshot records `missingSince`, `lastMissingAt` and an incremented `missingCount`.
3. Closure requires at least two missing observations and at least **24 hours since the first missing observation**. Two snapshots 12 hours apart do not close a job.
4. A failed, incomplete, candidate or removal-quarantined run does not advance closure.

`firstSeenAt` means first observed by Jobbely, not the provider's advertised publication date. `lastSeenAt` updates when the posting is observed. Closed records remain stored; the active catalog excludes them, while detail lookup can still return them.

## Removal quarantine

A count decrease greater than **30%** relative to the latest successful, complete, non-quarantined baseline blocks removal reconciliation. Seen jobs and run evidence still publish. A zero-job response after a populated baseline is quarantined.

Quarantined observations do not become the new baseline. Repeating a collapsed response must not gradually confirm mass closure. There is currently no operator acknowledgement/rebaseline command: genuine large decreases remain an investigation/workflow follow-up rather than being silently accepted.

## Tradeoffs and implementation

This policy favors retaining possibly unavailable jobs over incorrectly removing many active jobs. Candidate sources can retain outdated records because closure is intentionally disabled until scope verification. Cross-source duplicate requisition merging is not implemented.

[Pure policies](../backend/src/domain/lifecycle.ts), [snapshot application](../backend/src/infrastructure/storage/snapshot.ts), [policy tests](../backend/src/domain/policies.test.ts), [refresh behavior tests](../backend/src/application/sync-source.test.ts), [PostgreSQL lifecycle test](../backend/src/infrastructure/storage/postgres.test.ts).

Threshold changes require updated tests and documentation. See [SOURCES.md](SOURCES.md) for audit eligibility and [STORAGE.md](STORAGE.md) for atomicity.
