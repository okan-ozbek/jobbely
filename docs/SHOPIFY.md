# Decision: Shopify public careers integration

**Status:** Native adapter implemented; 116 jobs imported successfully; independent coverage partial. Recorded 6 October 2026, Europe/Amsterdam.

## Decision and rationale

Shopify is the second new employer from the [500-company backlog](TECH_COMPANIES_500.md), following [Atlassian](ATLASSIAN.md). Its [official careers page](https://www.shopify.com/careers) embeds a `jobPostingsWithJobs` array and location dictionary in literal React Router hydration data. Public posting pages embed `jobPosting.descriptionHtml`. The employer uses Ashby IDs, but the public posting API at the discovered lowercase board name returned HTTP 404; do not configure the generic Ashby adapter based solely on UUIDs or query parameter names.

A dedicated HTML adapter reads the employer's own published data through the existing ingestion port. The provider, company and source IDs are `shopify`. Add the native backlog expansion to Wave C, retaining existing source identities. The shared N/A logo remains until a reviewed vector is available. The source remains `candidate`, `scheduled: false`; successful retrieval does not approve employer-wide coverage, display rights or absence-based closure.

## Invariants

- Fetch only the exact unfiltered `/careers` page and public `/careers/<title-slug>_<posting-uuid>` detail pages on `www.shopify.com`. Query parameters, fragments, `.data`, careers search/portal routes, application requests and non-HTML modes are excluded. Shared HTTPS, pacing, retry, timeout, size and redirect restrictions apply.
- Read one literal `window.__reactRouterContext.streamController.enqueue("...")` JSON string. Never execute upstream JavaScript. Validate the reference table, property references and selected public posting/location fields. Cap it at 100,000 cells, 128 fields per selected record and 2,000 rows per selected array; reject missing, ambiguous, malformed or unsupported references. Cache decoded field maps to avoid repeated schema work. This is a narrow parser for the observed payload, not a general JavaScript or React Router interpreter. It does not traverse hiring-team, author, interview-plan or application-form objects.
- Enumerate the entire embedded array, not the initial visible anchors or a featured-role slice. Require native published status, unique posting IDs, matching underlying job IDs and known primary/secondary location IDs. Explicitly exclude unlisted records and the existing talent-community title patterns. An empty array has no independent total and fails rather than proving zero vacancies.
- Construct detail paths using the exact public title-slug transformation observed in Shopify's listing component. Each detail must echo the canonical URL and the same validated posting metadata. Preserve the original employer application link, and require its exact matching `ashby_jid`.
- Hydrate every retained posting's complete advertised `descriptionHtml`; sanitize through the existing pipeline. Missing/unreadable descriptions, changed metadata or failed details abort publication. Salary or generic page chrome cannot replace the role description.
- Preserve native departments, team labels, primary/secondary location names, explicit workplace and employment values. Preserve `publishedDate` as its calendar date string; do not invent a time or timezone. Missing optional metadata remains unknown.
- Re-fetch the entire inventory after detail hydration and compare all validated posting metadata and location names, independent of row ordering. Drift fails the run. Extraction has a two-hour budget; there is no partial-detail publication.

## Dated discovery and coverage boundary

The 6 October careers response embedded **116 published, listed postings**, but its initial visible HTML contained **37 distinct posting links**. The listing component additionally contains a six-role featured slice. These presentations cannot replace the full embedded array. A single public detail fetched during discovery contained a readable full role description and the expected immutable ID, even though its initial visible detail container was empty.

Shopify's [robots policy](https://www.shopify.com/robots.txt) permits the public bare careers and posting paths for the generic user agent, while disallowing data routes, careers portals and queried careers searches. `/careers/jobs` redirected to `/careers`; the collector uses the canonical bare endpoint and does not follow redirects. These observations are not access/display approvals. [Terms](https://www.shopify.com/legal/terms) remain a pending review reference.

The independent audit still reads visible posting anchors. Its listing page stays `complete: false`. It must retain a partial result when the visible inventory does not reconcile with all imported IDs; no technical checkmark is fabricated from matching the collector's own hydration array. Separate early-career programs, geographic/entity scope and other hiring channels remain review items.

Raw discovery output stays in ignored `backend/data/discovery/shopify/`. Successful runs retain exact raw HTML snapshots in PostgreSQL. Dated counts, availability and payload format can change.

## Live import and audit result

The PostgreSQL import at **12:26–12:28 UTC on 6 October** succeeded with 116 listings, zero exclusions, complete traversal of the captured array and no removal quarantine. It stored 118 raw HTML responses: initial inventory, 116 details and final inventory. A direct database check confirmed 116 Shopify postings and 116 job-feature projections. The canonical backfill inspected/updated 125 postings across the local database; that total includes other employers.

At **12:30 UTC**, the existing automatic audit workflow replayed the exact successful run's stored HTML and fetched the official visible inventory separately. All 37 visible posting IDs matched; 79 imported IDs were absent from that visible inventory. It persisted `verification.status: partial` bound to the successful run, with access status `unreviewed`. The [compact dated report](../backend/config/audit-evidence/shopify.json) records the discrepancy and exact run binding. No provider inventory was fetched a second time for this audit, and no manual coverage/access flags were approved.

This import proves that the captured native array and every retained detail were processed successfully. It does not resolve independent complete employer coverage or the remaining access/display review.

## Implementation and verification

- [Adapter](../backend/src/infrastructure/adapters/shopify.ts), [factory](../backend/src/infrastructure/adapters/factory.ts), [registry validation](../backend/src/infrastructure/registry.ts), [bounded transport](../backend/src/infrastructure/http.ts), [audit identities](../backend/src/infrastructure/audits/reconcile.ts).
- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [pending audit plan](../backend/config/source-audits.json), [machine backlog](TECH_COMPANIES_500.json).
- [Synthetic adapter tests](../backend/src/infrastructure/adapters/shopify.test.ts) cover full hydration without visible links, secondary locations, calendar dates, unknown optional fields, malformed/ambiguous/out-of-range references, duplicate IDs, filtered/empty inventories, foreign links, invalid/missing details, inventory drift, explicit exclusions and stable audit identities. [Transport tests](../backend/src/infrastructure/http.test.ts) cover denied data, query, portal, JSON and POST requests.

```powershell
pnpm --filter @jobbely/backend run sync --company shopify
pnpm --filter @jobbely/backend run audit --company shopify
```

Sync requires PostgreSQL. The standalone audit command fetches a fresh inventory and remains separate from imported-run verification; the wave worker reuses exact imported extraction evidence. Restart running API/worker processes after adding this source. See [WAVE_C](WAVE_C.md), [AUDITING](AUDITING.md), [AUTOMATIC_COVERAGE](AUTOMATIC_COVERAGE.md) and [QUALITY](QUALITY.md).
