# Decision: Replit public Ashby import

**Status:** Implemented; 70 jobs imported locally with full descriptions, native pay and matching features. Source candidate and scheduled; independent visible inventory and employer scope/access/display reviews remain pending. Recorded 6 October 2026, Europe/Amsterdam.

## Discovery and rationale

The [official careers page](https://replit.com/careers) directly links to [Ashby board replit](https://jobs.ashbyhq.com/replit). The public version-1 aggregate supplies 70 listed postings with native UUIDs, complete descriptions and original application links. Of these, 62 advertise structured compensation, each with one native tier. The existing Ashby adapter preserves provider summaries, component text, currency/interval and benefits without salary arithmetic or inferred ranges. Explicit display flags suppress structured compensation for the other eight entries.

Official careers HTML provides board links rather than per-posting identities. Hosted Ashby HTML is a JavaScript shell without visible vacancy links. These pages establish board association but cannot independently reconcile the imported inventory or establish zero jobs. Distinct UUIDs remain distinct when titles repeat. Generic non-vacancy exclusions produced zero exclusions.

The application owner's continuing onboarding request authorizes the local integration, and the earlier all-source scheduling instruction enables its refresh attempts. Employer scope/access/display review remains pending. The [terms](https://replit.com/terms-of-service), [privacy policy](https://replit.com/privacy-policy) and [Ashby API documentation](https://developers.ashbyhq.com/docs/public-job-posting-api) are captured as evidence. Service terms include content scraping restrictions; public ATS availability and accessible robots policies do not establish employer description display rights. No consent, reviewer or approved policy records are fabricated.

## Runtime invariants

- Stable company/source/board ID `replit`, provider `ashby`, Wave C, shared local N/A logo pending vector review. Source candidate and scheduled through [SCHEDULING.md](SCHEDULING.md).
- Reuse `https://api.ashbyhq.com/posting-api/job-board/replit?includeCompensation=true` through the existing adapter and bounded transport. No new provider, destination allowlist, credentials, private API or application submission.
- Preserve full sanitized HTML/text, publicly displayed compensation, native UUIDs, titles, original job/application URLs, departments/team, primary/secondary locations, employment/workplace labels and publication dates. Unknown optional values remain unknown.
- The post-import audit reuses the exact successful extraction and source run ID. It does not fetch a second feed or equate matching counts to employer-wide completeness.
- Candidate refreshes cannot advance absence counters or close jobs. Scheduling does not change employer approval, technical coverage, explicit blocked publication plans or removal quarantine.
- Raw public descriptions, policies, discovery records and diagnostic output remain in ignored backend data. Compact checked-in evidence retains identifiers, hashes, counts and limitations.

## Implementation and verification

PostgreSQL run `de59c9c0-a5bf-465a-9119-9b873224b70a` succeeded at 18:01:05 UTC on 6 October 2026 with 70 listed vacancies, zero exclusions, complete aggregate enumeration and no removal quarantine. Backfill created 70 matching features; the successful run retains one source snapshot. Database checks compare every active posting with that exact snapshot, including sanitized HTML/text, all native identities and URLs, labels, locations, dates and every advertised compensation summary/component. All feature content hashes match their postings. The shortest stored description contains 3,166 characters; all 62 displayed compensation tiers were preserved.

The [compact audit](../backend/config/audit-evidence/replit.json) establishes official board association and captures robots/policy evidence. All 70 feed IDs lack independent visible inventory mapping and traversal remains unreviewed. Persisted technical status is partial, access unreviewed, bound to the successful imported run above. Source completeness and an incomplete employer audit describe different verification levels.

API metadata and Wave C selection tests include Replit. The runtime registry now has 75 companies and 64 scheduled candidate sources across 61 configured companies. The 500-company backlog has 55 configured targets, eight registered-only and 437 new candidates. Lovable is the next proposed discovery target.

Final root `pnpm check` passed formatting, boundaries, logo validation, zero-warning lint, strict types, 761 tests (726 backend and 35 frontend), contracts and both builds. Its default environment skipped 28 PostgreSQL tests without `TEST_DATABASE_URL`; the explicit successful import/database checks above are separate evidence. No provider implementation or public contract changes were required. Backlog and documentation checks validated 500 unique targets across 20 categories of 25 and 1,134 local links.

The rebuilt local API and ingestion worker restarted healthy. Checks through `http://localhost:8080` confirmed 70 Replit jobs, complete detail descriptions, a paid posting's native compensation and original Ashby application link. All 64 configured sources report scheduled candidate state; the persistent exclusive wave schedule remains 00:00 and 12:00 UTC with no competing per-source cron entries. Replit reports a successful latest import, partial technical coverage and unreviewed access. Cursor's 132 jobs remained available. The configured browser origin is accepted; an actual Firefox UI session was not exercised. Full-cohort success is not established by this employer import or schedule check.

- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [audit plan](../backend/config/source-audits.json), [backlog](TECH_COMPANIES_500.json).
- [Ashby adapter](../backend/src/infrastructure/adapters/ashby.ts), [adapter tests](../backend/src/infrastructure/adapters/adapters.test.ts), [atomic workflow](../backend/src/application/sync-source.ts), [audit workflow](../backend/src/infrastructure/audits/wave-refresh.ts).
- [API metadata](../backend/src/api/app.test.ts), [wave selection](../backend/src/cli/select-sources.test.ts), [audit rules](AUDITING.md), [Wave C](WAVE_C.md), [quality checks](QUALITY.md).
