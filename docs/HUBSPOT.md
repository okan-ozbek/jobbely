# Decision: HubSpot unavailable-source gate

**Status:** Candidate registered with an explicit extraction blocker; job collection is not implemented. Recorded 6 October 2026, Europe/Amsterdam.

## Discovery and rationale

The official [careers page](https://www.hubspot.com/careers/jobs) links public careers configuration and directory scripts. The configuration names `https://wtcfns.hubspot.com/careers/graphql`. Its directory issues an unfiltered `Jobs` query and a `Job` detail query; client pagination and “Show all” operate on the returned listing array.

On 6 October, the public service returned HTTP 200 with GraphQL `404: Not Found` errors for both the listing and a previously public detail ID, `5990250`. The listing failed both as a read-only GET and with the website's POST query and empty filter arrays. Neither response supplied a usable job inventory or description. The actual careers HTML contained no visible numeric posting links; an empty client shell is not an empty hiring inventory.

The directory still links a Greenhouse alert using `hubspotjobs`, but that board's public jobs API returned HTTP 404. This alert does not establish a usable Greenhouse integration. No replacement board is guessed, and cached search-result counts are not used as current vacancies.

The careers service's robots URL returned HTTP 403. The employer website's robots file and [website terms](https://legal.hubspot.com/website-terms-of-use) were readable, but automated access and description display remain unreviewed. A failed robots response is not permission to collect that service.

Register HubSpot in Wave C as another backlog expansion, with stable company/source/board IDs `hubspot` and the observed endpoint. Reuse the existing explicit failure adapter until a usable complete public source and its access conditions are established. Adding a speculative success parser for an unavailable payload would not prove compatibility or completeness.

## Invariants

- Configuration remains `candidate`, `scheduled: false`; the shared N/A logo remains pending vector review.
- Extraction fails with a dated, actionable unavailable-source reason. It makes no network requests and never returns a successful empty extraction.
- Failed runs preserve existing postings, dataset publication version and absence counters through the normal ingestion workflow. They cannot establish successful enumeration, descriptions, matching projections, scheduling or closure.
- The observed endpoint is validated against the exact HubSpot company and board. It is recorded for discovery and hashing; it is not added to the runtime network allowlist.
- Scope, access/display and independent inventory reconciliation remain pending. No technical coverage checkmark or approval is fabricated.
- Raw discovery responses and upstream error traces stay in ignored `backend/data/discovery/hubspot/`; compact audit evidence records errors without those traces or job/application payloads.

## Implementation and verification

At **13:08 UTC on 6 October**, the canonical local PostgreSQL sync recorded failed run `bf05b040-ea6d-4e80-a9d0-8e3282da5a01`. A database query confirmed no HubSpot postings or snapshots, and the requirement backfill inspected/updated zero postings. At **13:09 UTC**, the official audit captured the employer page and legal policy and recorded unresolved scope/access, failed extraction and incomplete official traversal in the [compact report](../backend/config/audit-evidence/hubspot.json). Its zero counters describe unavailable evidence, not a verified zero-vacancy inventory. Both commands returned the expected nonzero status; neither activated the source.

[Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [endpoint validation](../backend/src/infrastructure/registry.ts), [adapter wiring](../backend/src/infrastructure/adapters/factory.ts), [failure adapter](../backend/src/infrastructure/adapters/restricted.ts), [pending audit plan](../backend/config/source-audits.json), [backlog](TECH_COMPANIES_500.json).

[Adapter tests](../backend/src/infrastructure/adapters/native.test.ts) check an explicit failure with no network calls. [Ingestion tests](../backend/src/application/sync-source.test.ts) use synthetic prior postings to check preservation and failed-run state. [Selection tests](../backend/src/cli/select-sources.test.ts) keep HubSpot available for manual Wave C investigation without enabling scheduling. [API tests](../backend/src/api/app.test.ts) check its registry presentation.

```powershell
pnpm --filter @jobbely/backend run sync --company hubspot
pnpm --filter @jobbely/backend run audit --company hubspot
```

Both commands are expected to report blockers. Sync requires PostgreSQL. Before replacing the failure gate, rediscover the official source, establish full unfiltered traversal and complete readable descriptions, validate employer/application identities, review access conditions, and reconcile exact imported-run evidence independently. See [AUDITING](AUDITING.md), [AUTOMATIC_COVERAGE](AUTOMATIC_COVERAGE.md), [WAVE_C](WAVE_C.md) and [QUALITY](QUALITY.md).
