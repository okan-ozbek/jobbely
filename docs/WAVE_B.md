# Decision: Wave B enterprise integrations

**Status:** All 31 companies configured; 29 feeds fully imported, NVIDIA and LinkedIn blocked. Employer audits remain pending. Recorded 30 September 2026 (UTC).

## Decision and rationale

Reuse the three existing ATS adapters and add Workday CXS and iCIMS/Jibe adapters. A shared factory wires the same implementations into ingestion and auditing. All 31 Wave B companies have a source and an audit plan. LinkedIn has an explicit access gate that fails extraction until an authorized employer feed is available; it is not a functioning scraper or a zero-job result.

Discovery uses official career pages and actual public payloads rather than the provider hypotheses in the MVP plan. Snowflake and Patreon currently expose Ashby feeds. Optiver's active Greenhouse token is `optiverus`, not the empty `optiver` board; HRT uses `wehrtyou`. Blizzard's board is now on the Xbox Gaming Workday tenant. These are dated observations, not automatic future provider detection.

| Family     | Wave B companies                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Greenhouse | Databricks, Airbnb, HRT, Optiver, Pinterest, Datadog, Dropbox, Coinbase, Stripe, MongoDB, Okta, Cloudflare, GitLab, Riot Games |
| Ashby      | Snowflake, Patreon                                                                                                             |
| Lever      | Spotify                                                                                                                        |
| Workday    | NVIDIA, Salesforce, Slack, Adobe, Workday, PayPal, Intel, ING, Zoom, Blizzard                                                  |
| iCIMS/Jibe | AMD, Booking.com, GitHub                                                                                                       |
| Restricted | LinkedIn; express permission/authorized feed required                                                                          |

## Workday traversal and identity

Search uses the public CXS `jobs` endpoint with an empty search string and no initial location filters. Each request is a read-only JSON POST. Pagination advances by the actual number of returned postings. The first page supplies the total; later nonempty pages can return `total: 0` as a sentinel. That sentinel never establishes an empty board. Premature empty pages, repeated identities, changed nonzero totals and invalid objects fail traversal.

Workday caps search totals at 2,000. The adapter partitions by source-native, single-valued job category, worker subtype or time-type facets only when every partition can be exhausted below that cap. It checks facet counts, exact posting sets, partition overlap and a final inventory recheck. Missing/unusable partitions fail explicitly. Overlapping location facets are not used to claim complete coverage. Native job-category descriptors are retained for deterministic classification; unsupported labels still use the existing title strategies or remain unclassified.

Every enumerated posting receives a detail request. Its immutable native `id` is stored separately from the mutable title/requisition slug in its URL. Captured detail responses map official URL slugs to those immutable IDs during auditing. Detail descriptions, secondary locations, employment labels and advertised dates are retained; unknown workplace values remain unknown. A disappeared, malformed or foreign-board detail fails the complete extraction instead of publishing half a source.

Native canonical links may use the tenant's `myworkdayjobs.com` origin or its matching regional `wd<number>.myworkdaysite.com/recruiting/<tenant>/<site>/` origin. Both tenant and site must match; an arbitrary regional host/path is rejected. These are application links, not a broader network fetch allowlist. Captured POST evidence includes the request body so offsets and facet filters are reviewable.

Search is bounded to 2,000 requests, hydration to 10,000 postings, and extraction to two hours. Shared transport pacing remains one request per host per second. A large first Workday import can take tens of minutes. Publication remains atomic after all details succeed. The separate `enumerate` infrastructure method supports traversal diagnostics; enumeration-only evidence cannot be imported as full job details.

## iCIMS employer scope

The public `/api/jobs` feed returns full descriptions. Traverse numbered pages with a requested page size of 100, using the actual received items and explicit `totalCount`; reject duplicates, drift, premature termination and malformed descriptions. Source categories and application links remain native.

Booking.com's feed contains Booking Holdings vacancies. Its explicit `employerFilter` includes only jobs whose native `brand` is exactly `Booking.com`; other brands are counted as exclusions. A missing membership field fails the run. GitHub's canonical posting URLs use the specifically configured `githubinc.jibeapply.com` alias; this is a link identity allowance, not a new arbitrary fetch destination. Canonical URL hosts and membership rules are bound into the audit configuration hash.

Slack uses the dedicated `Slack` Workday site, rather than a text search across Salesforce. Salesforce's broader board can overlap with that subsidiary; postings remain distinct per source and no cross-company deduplication is inferred.

## Operator workflow and limits

```powershell
pnpm sync:wave-b
pnpm audit:wave-b
pnpm --filter @jobbely/backend run sync --company nvidia
```

Sync requires PostgreSQL mode and continues after a failed source. The whole Wave B command currently exits unsuccessfully for NVIDIA and LinkedIn, while successful sources still publish. LinkedIn's [published robots policy](https://www.linkedin.com/robots.txt) requires express permission for automated access. The old empty SmartRecruiters feed was not substituted as evidence of current vacancies.

All new sources remain `candidate` and unscheduled. Feed retrieval does not establish worldwide employer scope, access/display approval or safe closure. The existing [audit procedure](AUDITING.md) still applies. Plans start pending; JavaScript-only official inventories need reviewed collectors before activation can pass. No approval was fabricated during onboarding. Restart running API/worker processes after configuration changes.

During the initial live check, NVIDIA's feed advertised requisition `JR2018974` as an object containing only `bulletFields`, with no title or detail path. A native requisition search reproduced it. An attempted lookup using the requisition alone returned 404, but the missing native detail path prevents establishing which detail URL belongs to that listing. Extraction consequently fails and preserves prior data. This is an upstream integrity blocker, not proof of an expired posting or zero NVIDIA vacancies; do not remove the validation or silently discard the entry to report complete traversal.

Long imports renew their source lease every minute while preserving the 30-minute crash expiry. Renewal cannot revive an expired lease or replace another owner. The worker queue permits a three-hour job lifetime, including validation/publication overhead; it does not automatically schedule candidates. See [INGESTION.md](INGESTION.md) and [STORAGE.md](STORAGE.md).

## Implementation and verification

- [Workday adapter](../backend/src/infrastructure/adapters/workday.ts), [iCIMS adapter](../backend/src/infrastructure/adapters/icims.ts), [LinkedIn access gate](../backend/src/infrastructure/adapters/linkedin.ts), [adapter factory](../backend/src/infrastructure/adapters/factory.ts).
- [Source configuration](../backend/config/sources.json), [audit plans](../backend/config/source-audits.json), [configuration validation](../backend/src/infrastructure/registry.ts).
- [Enterprise behavior tests](../backend/src/infrastructure/adapters/enterprise.test.ts), [transport tests](../backend/src/infrastructure/http.test.ts), [lease tests](../backend/src/infrastructure/storage/postgres.test.ts).
- Live counts and validation levels belong in [SOURCE_CHECKS.md](SOURCE_CHECKS.md). Full extraction, traversal with sampled details, database publication and official scope verification are separate evidence levels.
- [Durable integration report](../backend/config/integration-evidence/wave-b.json) records per-company runs, imported counts, representative links and configuration hashes. Its diagnostic file hashes refer to earlier local traversal/extraction artifacts, which can differ in count from a later import. The database `Snapshot` tied to each successful run is the exact publication evidence. This report is separate from audit approval evidence.
