# Decision: ServiceNow public SmartRecruiters postings

**Status:** Adapter implemented; 705 vacancies imported with full descriptions. Independent coverage remains partial, access/display review pending, source candidate and unscheduled. Recorded 6 October 2026, Europe/Amsterdam.

## Decision and rationale

Use the documented public SmartRecruiters Posting API for ServiceNow. The public `ServiceNow` company endpoint exposed 705 listings during discovery, and a public detail provided the complete company, role, qualification and additional-information sections. Full descriptions require separate detail retrieval; search summaries cannot satisfy that promise. Preserve the shared ingestion, HTML preparation, classification, job-feature and audit boundaries.

The employer's [main inventory](https://careers.servicenow.com/jobs/) and home page returned HTTP 403 challenge pages to automated discovery. The [hosted board](https://careers.smartrecruiters.com/servicenow) and public posting API were independently accessible. No challenge, credential or application endpoint is bypassed. A hosted board's own name does not establish complete employer attribution or scope; the independent audit must retain the official-site failure.

SmartRecruiters documents [public API access](https://developers.smartrecruiters.com/docs/authentication), [public-only listing parameters](https://developers.smartrecruiters.com/reference/v1listpostings), [detail retrieval](https://developers.smartrecruiters.com/reference/v1getposting) and [advertisement sections](https://developers.smartrecruiters.com/docs/objects). API availability is separate from review of ServiceNow's [website terms](https://www.servicenow.com/terms-of-use.html) and description-display conditions.

## Invariants

- Company/source IDs are `servicenow`; the provider is `smartrecruiters` and native board identifier is `ServiceNow`. Registry validation binds this exact company, board and endpoint. The source remains `candidate`, `scheduled: false`, using the local N/A logo until vector review.
- Runtime transport permits only public JSON GET lists with `limit=100`, bounded numeric `offset`, and `destination=PUBLIC`, plus numeric posting details. Queries cannot request internal postings or restrict geography, department, title or language. POST, configuration, candidate/application routes, tracking queries, fragments, HTML and other company endpoints remain denied. Shared pacing, timeout, retry, redirect and body-size limits apply.
- Advance pagination by the actual received count. Require echoed offsets/limits, stable totals, unique numeric IDs and UUIDs, exact employer identifiers and same-board detail references. Reject repeated identities, early empty pages, excess rows, changed totals and schema failures. Bound each inventory to 10,000 postings and 100 pages, with a two-hour extraction budget.
- Hydrate every advertised posting before publication. Require active, public details whose ID, UUID, title, date, location and meaningful native labels match their summaries. Empty, null and absent optional label objects all mean unknown; differing property insertion order is not a metadata change. Actual label changes fail.
- Validate both original posting and application links against the same board and numeric ID, retaining the native title slug. Only the observed optional `oga=true` application query is accepted. Application URLs are outbound links and are never fetched.
- Retain all four advertised textual sections, including salary and benefits within their original text, and any supplied video links. Escape section headings; sanitize HTML through the existing pipeline. The role section must itself be readable: generic company/footer text cannot replace it. Structured compensation retains exact advertised minimum/maximum amounts, currency and native pay period without inventing an absent bound. Unknown sections or malformed/unfamiliar compensation fail rather than silently losing advertised content. That conservative rule can require a schema extension if upstream introduces another public content format.
- Preserve department and function labels, complete advertised location, employment label and native release timestamp. Explicit remote/hybrid flags map to those workplace values; absence remains unknown. No location, employment, publication date or onsite assumption is invented.
- Re-enumerate every listing page after hydration and compare all validated summary records independent of row ordering. Any inventory drift fails the entire run. No partial-detail snapshot is published, and failure preserves prior listings and removal counters.

## Coverage and scope boundary

The employer's [careers navigation](https://careers.servicenow.com/jobs/) also names a separate Moveworks hiring channel and Magnit contractor positions. They remain explicitly pending channels in the audit plan. This integration does not establish all subsidiary/contractor coverage or deduplicate separate employer boards by title. The unchanged 500-company backlog retains individually scoped employer targets.

The main inventory's challenge, hosted-board pagination, independent employer attribution, additional hiring channels and access/display reviews remain coverage blockers. A successful API import is not an employer-wide checkmark, permission decision or source activation. The audit receives the exact imported extraction and run ID rather than fetching a different provider snapshot for comparison.

Raw discovery responses, failed-attempt diagnostics and live progress stay under ignored `backend/data/discovery/servicenow/`. Successful raw provider snapshots are stored atomically with their PostgreSQL run. Compact audit evidence contains identities/counts/errors and policy hashes rather than full advertisements, creator records or upstream payloads.

## Implementation and verification

The successful PostgreSQL run `1bdd3a25-3e80-495a-9bf5-7a95f4d50f72` ran from 13:30:42 to 13:40:17 UTC on 6 October 2026. All 706 advertised entries were hydrated; one explicit non-vacancy entry was excluded, leaving 705 active vacancies. The atomic publication stored 722 raw snapshots: eight initial inventory pages, 706 details and eight final inventory pages. Job-feature backfill updated all 705 vacancies. A database read confirmed these counts and preservation of the advertised USD 37.56 maximum hourly compensation.

This manual onboarding attempt reused 147 detail responses captured during an earlier attempt after a parser correction. Their original timestamps were retained; stored evidence spans 13:25:34–13:40:17 UTC. Listing pages and the final inventory recheck were freshly requested, and each detail had to match that inventory. The production adapter has no persistent response cache. The independent audit reconstructed the same validated extraction only after checking every captured response against the successful run's stored snapshots, including URLs, bodies and timestamps; it did not compare against another provider import.

The [compact audit](../backend/config/audit-evidence/servicenow.json), observed at 13:42:34 UTC and bound to that exact source run, kept technical coverage partial and access unreviewed. The official inventory returned HTTP 403 and the hosted-board audit fetch failed. No visible official posting IDs were available for independent matching, so all 705 feed IDs remain unmatched; this does not mean they are absent from the actual employer website. Moveworks and Magnit channels, employer attribution, traversal and policy/display review remain pending. Both policy documents were captured successfully without approving their terms.

`pnpm check` passed formatting, dependency boundaries, logo validation, zero-warning lint, types, 691 tests and builds. The 28 PostgreSQL suite tests were skipped because `TEST_DATABASE_URL` was absent; the live import and explicit database checks above are separate evidence.

- [Adapter](../backend/src/infrastructure/adapters/smartrecruiters.ts), [factory](../backend/src/infrastructure/adapters/factory.ts), [registry validation](../backend/src/infrastructure/registry.ts), [transport](../backend/src/infrastructure/http.ts), [audit identities](../backend/src/infrastructure/audits/reconcile.ts), [official audit hosts](../backend/src/infrastructure/audits/auditor.ts).
- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [pending plan](../backend/config/source-audits.json), [machine backlog](TECH_COMPANIES_500.json).
- [Synthetic adapter tests](../backend/src/infrastructure/adapters/smartrecruiters.test.ts) check pagination, every detail, complete textual content, full rechecks, same-count identity replacement, metadata drift, repeated IDs/UUIDs, foreign references, private/inactive/malformed details, unknown sections, unsupported compensation, readable role content, optional metadata, explicit exclusions and stable numeric audit identities. [HTTP tests](../backend/src/infrastructure/http.test.ts) deny filtered/internal/application routes. [Audit tests](../backend/src/infrastructure/audits/auditor.test.ts) scope employer policy hosting.

```powershell
pnpm --filter @jobbely/backend run sync --company servicenow
pnpm --filter @jobbely/backend run audit --company servicenow
```

Sync requires PostgreSQL and can take over ten minutes at normal pacing. Standalone audit fetches a new provider inventory; the wave worker instead reuses exact imported extraction evidence. Restart the API and worker after registry changes. See [WAVE_C](WAVE_C.md), [AUDITING](AUDITING.md), [AUTOMATIC_COVERAGE](AUTOMATIC_COVERAGE.md), [INGESTION](INGESTION.md) and [QUALITY](QUALITY.md).
