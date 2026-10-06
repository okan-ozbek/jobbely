# Decision: Atlassian native careers integration

**Status:** Adapter and candidate source implemented; full live import blocked. Recorded 6 October 2026, Europe/Amsterdam.

## Decision and rationale

Atlassian is the first new employer from the [500-company backlog](TECH_COMPANIES_500.md). Its [official job search](https://www.atlassian.com/company/careers/all-jobs) consumes an unfiltered JSON array at [the native listing endpoint](https://www.atlassian.com/endpoint/careers/listings). This is a different payload from the existing iCIMS/Jibe adapter. A dedicated backend adapter preserves the application's ingestion ports and atomic publication workflow. Add this native expansion to Wave C, retaining the original five priority integrations and stable existing identifiers.

The runtime company/source IDs are `atlassian`. The company uses the existing N/A logo pending a reviewed vector. Source status remains `candidate`, `scheduled: false`. Registration does not establish successful import, employer coverage, access/display permission or closure eligibility.

## Invariants

- Fetch only the exact unfiltered HTTPS listing endpoint. Existing transport bounds, pacing, timeout, retry and redirect restrictions apply. Never fetch or submit an application.
- The array is the inventory used by the official site; there is no observed server pagination or independent total. Cap input at 10,000 rows. Reject malformed or empty responses rather than treating them as a successful zero-vacancy inventory.
- Preserve native numeric posting IDs. Collapse records identical in all validated posting fields; reject conflicting records for an ID. Recheck the complete normalized inventory, independently of ordering and repetition, before returning a successful extraction. Identity/content drift fails the run.
- Validate top-level and nested posting/portal IDs. Posting links must use the exact observed host for that portal and the same posting ID. Application links must match that posting's origin/path and `?mode=apply`. Unrecognized portals fail pending attribution review.
- Retain overview, responsibilities, qualifications, compensation and pay-range HTML for downstream sanitization. A real vacancy with no readable overview/duties/qualification content fails the entire extraction. Salary-only content cannot substitute for a job description. The existing explicit talent-community title exclusions apply.
- Preserve all locations and category labels. Omitted employment, publication date and workplace remain unknown; an update timestamp is not a publication date. A location containing “Remote” does not establish the workplace policy for a multi-location posting.
- The aggregate currently links global, APAC, Americas, global campus, Americas campus and global mobility portals. These observed aliases support link validation and audit identity resolution, not independent scope approval.

## Dated live evidence and blocker

The 6 October discovery response contained **354 rows and 336 unique posting IDs**. Repeated IDs had identical payloads. Posting [26639, Senior Machine Learning Systems Engineer](https://www.atlassian.com/company/careers/details/26639), lacked overview, responsibilities and qualifications. Its official detail page also displayed no job-description content. The adapter must report `Atlassian posting 26639 has no readable job description`; it cannot publish the other roles as a complete snapshot.

The generic `User-agent: *` policy observed at [robots.txt](https://www.atlassian.com/robots.txt) did not exclude the native feed or these public careers paths. This observation is not an access/display approval. The audit plan keeps both reviews pending and the dynamic HTML page `complete: false`; a JavaScript shell cannot reconcile a complete inventory. No coverage badge or scheduling/closure activation is justified by this implementation.

Raw discovery output remains in ignored `backend/data/discovery/atlassian/`. Public availability, counts and description completeness may change. A future successful import still requires independent technical reconciliation and the established scope/access/lifecycle gates.

At 12:02 UTC the implemented adapter reproduced the missing-description failure against the live feed. The PostgreSQL sync command then recorded a failed Atlassian run; a direct database check confirmed zero Atlassian postings and zero published snapshots. The candidate audit at 12:05 UTC confirmed official linking, the description blocker and unreviewed complete listing traversal. Its [dated report](../backend/config/audit-evidence/atlassian.json) is failure evidence, not an activation approval. The actual HTML privacy-policy reference is retained for pending policy review; robots hashes are captured separately by the audit transport.

## Implementation and verification

- [Adapter](../backend/src/infrastructure/adapters/atlassian.ts), [factory](../backend/src/infrastructure/adapters/factory.ts), [registry validation](../backend/src/infrastructure/registry.ts), [bounded transport](../backend/src/infrastructure/http.ts), [official identity resolution](../backend/src/infrastructure/audits/reconcile.ts).
- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [pending audit plan](../backend/config/source-audits.json), [machine backlog](TECH_COMPANIES_500.json).
- [Adapter behavior tests](../backend/src/infrastructure/adapters/atlassian.test.ts) cover all six portals, duplicate/drifting inventories, full description sections, missing descriptions, foreign/mismatched application URLs, explicit unknowns, malformed/empty arrays and talent-community exclusion. [Transport tests](../backend/src/infrastructure/http.test.ts) cover exact endpoint restriction and rejected filtered/HTML/POST routes. Existing synchronization failure tests cover preservation of the published snapshot on extraction failure.

```powershell
pnpm --filter @jobbely/backend run sync --company atlassian
pnpm --filter @jobbely/backend run audit --company atlassian
```

Sync requires the configured PostgreSQL environment. The current upstream description defect is expected to return a failed run. Restart running API/worker processes after registry changes. See [WAVE_C](WAVE_C.md), [AUDITING](AUDITING.md) and [QUALITY](QUALITY.md).
