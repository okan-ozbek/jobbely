# Decision: Notion public Ashby board

**Status:** Implemented using the existing Ashby adapter; 133 vacancies imported with full descriptions and matching job features. Technical coverage verified for the observed official inventory; employer-scope/access/display reviews remain pending, source candidate and unscheduled. Recorded 6 October 2026, Europe/Amsterdam.

## Discovery and rationale

The [official careers page](https://www.notion.com/careers) exposes 133 distinct public links to the Ashby `notion` board in its unfiltered HTML. The [hosted board](https://jobs.ashbyhq.com/notion) and public Posting API were accessible. The version-1 aggregate supplied all 133 listed postings with full HTML descriptions, stable UUIDs, primary/secondary locations and original application links. Reuse the existing adapter without adding a native scraper, a new network host or application requests.

[Ashby's public API documentation](https://developers.ashbyhq.com/docs/public-job-posting-api) describes the aggregate, listed/unlisted flag, full descriptions and optional compensation response. That API contract does not approve employer-description republication. Notion's careers, robots and [privacy policy](https://www.notion.com/trust/privacy-policy) were accessible. Its legacy Terms & privacy navigation target returned a redirect to an `app.notion.com` document; the audit does not follow redirects or read that app document. Automated retrieval and full-description display review remain pending, with no fabricated consent or reviewer.

## Invariants and limits

- Stable company/source/board IDs are `notion`; provider is `ashby`, in Wave C. Use the existing local N/A logo pending vector review. The registry remains candidate and unscheduled.
- Request the existing unfiltered `https://api.ashbyhq.com/posting-api/job-board/notion?includeCompensation=true` endpoint through shared HTTPS transport, limits, pacing and retries. The aggregate supplies descriptions; no per-posting detail or application page is fetched by ingestion.
- Preserve native posting UUIDs, titles, complete advertised HTML, department/team labels, primary and distinct secondary locations, employment/workplace fields and native publication timestamps. The shared use case rejects duplicate IDs, unsafe URLs and unreadable descriptions before atomic publication. Existing unlisted/non-vacancy exclusions remain counted; this run contained none.
- All 133 observed compensation objects had null summaries and empty tiers/components. The full descriptions retain advertised pay text where present. This is dated evidence, not a promise that future structured compensation will be empty. The existing adapter does not separately project structured compensation; changes to that payload need renewed content review.
- Audit the exact imported extraction/run against fresh, visible official posting IDs in both directions. Neither the provider's own board name, embedded script text nor matching counts alone establishes employer attribution or inventory coverage.
- The audit plan's unfiltered official careers page is sufficient for the observed listing inventory; the hosted board is discovery evidence rather than a second required inventory. No JavaScript execution, synthetic empty marker, filter selection or unsupported identity equivalence is added.
- Technical verification remains independent of access approval, scheduling and absence-based closure. It describes the current configured official inventory, not every undiscovered subsidiary/entity/channel. Traditional scope/access reviews remain pending even after the automatic technical checks pass.
- Raw discovery/policy HTML stays under ignored `backend/data/discovery/notion/`; the successful provider aggregate is stored with its database run. Compact evidence stores hashes, counts, posting identities and review blockers rather than full advertisements or applicant data.

## Implementation and verification

PostgreSQL run `a534eaa4-0f88-4f2d-bda2-dda8ae22540e` succeeded at 15:39:19 UTC on 6 October 2026, with 133 vacancies, zero exclusions, complete enumeration and no removal quarantine. One raw aggregate snapshot was stored. Backfill ran through the existing public-feature workflow; database checks confirmed all 133 Notion feature/content hashes matched.

Every stored description exactly matched the complete sanitized native HTML, with a minimum of 5,212 readable characters. Original posting/application URLs, posting IDs, advertised publication/employment fields and all distinct primary/secondary locations matched the captured aggregate. Original identities were preserved without title-based merging.

The [compact audit](../backend/config/audit-evidence/notion.json), captured at 15:39:23 UTC and bound to that exact imported run, matched all 133 visible official IDs to all 133 imported IDs. Neither direction contained unmatched IDs; details, board attribution and traversal passed with no technical blockers. Persisted technical coverage is verified and access unreviewed. Both policy documents were captured and hashed, without approving their conditions. Scope/access review blockers remain in the traditional report and the source stays candidate/unscheduled.

Final `pnpm check` passed formatting, dependency boundaries, logo validation, zero-warning lint, types, 710 tests (675 backend and 35 frontend), contracts and both builds. The default suite skipped 28 PostgreSQL tests because `TEST_DATABASE_URL` was absent; the explicit import/database checks above are separate evidence. Backlog validation confirmed 500 unique targets across 20 categories of 25, matching the updated registry of 68 employers and 57 sources. The shortlist contains 48 configured employers, eight registered-only targets and 444 new candidates. All 948 local documentation links resolved.

The rebuilt local API and ingestion worker restarted successfully. Checks at `http://localhost:8080` confirmed 133 searchable Notion jobs, readable full details, original application links and the configured CORS origin. Public company metadata reports healthy status with verified technical coverage, no technical blockers and unreviewed access; the source remains candidate and unscheduled.

- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [pending audit plan](../backend/config/source-audits.json), [backlog](TECH_COMPANIES_500.json).
- [Existing adapter](../backend/src/infrastructure/adapters/ashby.ts), [provider behavior tests](../backend/src/infrastructure/adapters/adapters.test.ts), [shared workflow](../backend/src/application/sync-source.ts), [identity reconciliation](../backend/src/infrastructure/audits/reconcile.ts), [API metadata](../backend/src/api/app.test.ts), [wave selection](../backend/src/cli/select-sources.test.ts).

```powershell
pnpm --filter @jobbely/backend run sync --company notion
pnpm --filter @jobbely/backend run audit --company notion
```

Sync requires PostgreSQL. Standalone audit fetches a new provider inventory and retains the traditional scope/access blockers; the wave worker assesses exact imported evidence instead. Restart API/worker processes after registry changes. See [ADAPTER](ADAPTER.md), [AUDITING](AUDITING.md), [AUTOMATIC_COVERAGE](AUTOMATIC_COVERAGE.md), [LIFECYCLE](LIFECYCLE.md) and [QUALITY](QUALITY.md).
