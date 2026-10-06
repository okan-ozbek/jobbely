# Decision: Perplexity public Ashby integration

**Status:** Implemented; 130 vacancies and matching features imported. Independent official attribution/inventory remains unverified; employer scope/access/display review pending, source candidate and unscheduled. Recorded 6 October 2026, Europe/Amsterdam.

## Discovery and rationale

The [Perplexity careers route](https://www.perplexity.ai/hub/careers) and homepage returned HTTP 403 challenges during discovery. The bare perplexity.ai hostname redirects to www; canonical routes are requested directly without following redirects or bypassing challenges. Employer terms/privacy routes also returned HTTP 403. These failures are recorded, not interpreted as empty vacancy inventories or permission decisions.

The public [Ashby Perplexity board](https://jobs.ashbyhq.com/Perplexity) and version-1 aggregate are accessible without credentials. Native board metadata identifies the organization as Perplexity, its public website as www.perplexity.ai and its recruiting privacy URL as the employer's legal privacy route. This is branded provider attribution; no fresh outgoing employer-site link was independently confirmed. The hosted HTML is a JavaScript shell with no visible posting links and cannot establish exhaustive official inventory.

The aggregate supplied 130 listed postings, all with readable full descriptions and native UUIDs. Of these, 109 have displayed structured compensation, each with a native pay tier. Existing Ashby compensation handling preserves provider summaries, salary/equity component text, currencies and intervals without invented geography or arithmetic. Descriptions also retain native benefits and regional-pay caveats. Distinct UUIDs remain distinct even where titles repeat.

Listed internship, paid research fellowship and defined early-career/full-time hiring programs remain available; they are not discarded based on broad title keywords. Existing generic non-vacancy exclusions produced zero exclusions for this source. Advertisement instructions remain listing content; no application is written or submitted.

## Runtime invariants

- Stable company/source ID `perplexity`, provider `ashby`, case-preserved native board `Perplexity`, Wave C. The shared local N/A logo awaits vector review. Candidate state, scheduling disabled.
- Reuse `https://api.ashbyhq.com/posting-api/job-board/Perplexity?includeCompensation=true` through the existing adapter/transport. No new ingestion host, provider, credentials, private API or application request.
- Keep the complete sanitized description and publicly displayed compensation, original employer/application URLs, UUIDs, departments/team, primary/secondary locations, explicit workplace/employment labels and advertised publication date. Unknown optional values remain unknown.
- The audit binds the exact successful imported snapshot and run ID. All 130 feed identities remain independently unreconciled because employer HTML is challenged and hosted HTML supplies no visible posting links.
- Scope/access/display plans remain pending, with no fabricated reviewer, consent or policy hashes for unavailable documents. Public API compatibility and ATS branding do not approve employer scope, automated collection, description display, scheduling or closure.
- Failed official requests preserve their errors and partial technical status. The source's successful feed enumeration does not establish worldwide employer completeness. Raw advertisements, challenges and discovery records stay in ignored backend data; compact checked-in evidence records identifiers, hashes, counts and limitations.

## Implementation and verification

PostgreSQL run `f943dee7-4197-4cac-8d0f-21e39d3701e9` succeeded at 17:25:06 UTC on 6 October 2026 with 130 listed vacancies, zero exclusions, complete aggregate enumeration and no removal quarantine. Backfill created 130 matching job features. Database checks compared every active posting with the exact successful source snapshot, including complete sanitized HTML/text, native UUIDs, titles, original URLs, departments, locations, workplace/employment labels and publication timestamps. All feature content hashes match their postings. Every native description and all 109 advertised compensation sections were preserved; the shortest stored description contains 1,010 characters.

The [compact audit](../backend/config/audit-evidence/perplexity.json), captured at 17:25:09 UTC, binds that successful run. It retains HTTP 403 on the employer careers page, unresolved employer linking/traversal and all 130 unmatched feed IDs. Employer terms/privacy retrieval failed with recorded HTTP 403 errors; [Ashby public API documentation](https://developers.ashbyhq.com/docs/public-job-posting-api) was captured successfully. Persisted technical status is partial and access unreviewed. A successful import and an incomplete audit describe different verification levels.

Final `pnpm check` passed formatting, dependency boundaries, logo validation, zero-warning lint, strict types, 754 tests (719 backend and 35 frontend), contracts and both builds. The default suite skipped 28 PostgreSQL tests without `TEST_DATABASE_URL`; explicit successful import/database verification above is separate evidence. API metadata and Wave C selection checks now include Perplexity. Existing Ashby behavior tests remain unchanged and passing; no provider/contract implementation changes were required.

Backlog validation confirmed 500 unique targets across 20 categories of 25, consistent with 73 runtime employers and 62 sources. The shortlist has 53 configured employers, eight registered-only and 439 new candidates; all 1,063 local documentation links resolved. Anysphere (Cursor) is the next proposed discovery target; its homepage seed remains unverified.

The rebuilt local API and ingestion worker restarted healthy. Checks through `http://localhost:8080` confirmed 130 Perplexity jobs, full detail descriptions, advertised compensation on a paid posting and original Ashby application links. The API reports partial company/technical status, unreviewed access, a successful latest import and disabled candidate scheduling. The configured browser origin is accepted; Mistral AI's 208 jobs and Hugging Face's five jobs remained available. This is local API/CORS verification; an actual Firefox UI session was not exercised. Frontend behavior/schema was unchanged.

- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [pending audit plan](../backend/config/source-audits.json), [backlog](TECH_COMPANIES_500.json).
- [Ashby adapter](../backend/src/infrastructure/adapters/ashby.ts), [adapter behavior tests](../backend/src/infrastructure/adapters/adapters.test.ts), [atomic workflow](../backend/src/application/sync-source.ts), [audit workflow](../backend/src/infrastructure/audits/wave-refresh.ts).
- [API metadata](../backend/src/api/app.test.ts), [wave selection](../backend/src/cli/select-sources.test.ts), [audit rules](AUDITING.md), [Wave C](WAVE_C.md), [quality checks](QUALITY.md).
