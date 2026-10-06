# Decision: Mistral AI current public Ashby board

**Status:** Implemented using Ashby; 208 vacancies imported with full descriptions and matching job features. Independent technical coverage remains partial; employer-scope/access/display reviews remain pending, source candidate and unscheduled. Recorded 6 October 2026, Europe/Amsterdam.

## Discovery and rationale

The [official careers page](https://mistral.ai/careers/) links directly to the [Ashby `mistral.ai` board](https://jobs.ashbyhq.com/mistral.ai). Its public version-1 aggregate supplied 208 listed postings with complete HTML, UUIDs, original job/application URLs, publication dates, employment/workplace fields and primary/secondary locations. The old Lever hosted board returned 404 and its public API returned an empty array. Do not configure the retired source or treat its empty response as zero current employer vacancies.

Reuse the existing Ashby adapter. The board name contains a dot, requiring an Ashby-only identifier extension shared between registry validation and official URL reconciliation. Other providers retain their existing board syntax. No new ingestion host, native scraper, application request or authentication is introduced.

The official landing page provides board association but no individual posting links. The hosted board returned a JavaScript shell without visible vacancy links. Embedded provider data remains discovery evidence, not an independent visible inventory; neither the feed's own count nor the shell can prove worldwide coverage or zero vacancies.

Official policy links point to `legal.mistral.ai` and initially redirect to canonical paths. Request the [legal-center landing page](https://legal.mistral.ai/terms/get-started/), [applicant privacy policy](https://legal.mistral.ai/terms/applicant-privacy-policy/) and [English privacy policy](https://legal.mistral.ai/terms/privacy-policy/?language=en-US) directly. Capture [Ashby documentation](https://developers.ashbyhq.com/docs/public-job-posting-api) separately. Policy availability and public API access do not approve full-description republication; reviews remain pending without fabricated consent or reviewer.

## Invariants and limits

- Stable company/source IDs are `mistral-ai`; board is exactly `mistral.ai`, provider `ashby`, Wave C. The local N/A logo remains pending vector review. Source candidate, scheduling disabled.
- Fetch `https://api.ashbyhq.com/posting-api/job-board/mistral.ai?includeCompensation=true` through existing shared HTTPS transport, pacing, limits and retries. No detail or application page is fetched by ingestion.
- Ashby board names allow nonempty dot-separated segments containing letters, digits, underscores and hyphens. Reject empty segments, leading/trailing dots, slashes, query characters and encoded escapes. Dotted Greenhouse/Lever and other provider board names remain invalid. The same Ashby pattern governs its hosted URL board identity.
- Preserve full sanitized descriptions, UUIDs, normalized titles, original departments/teams, distinct primary/secondary locations, employment/workplace fields, publication dates and employer/application links. Shared ingestion validates readable content and duplicate IDs before atomic publication. All 208 postings were listed and zero exclusions applied.
- All observed compensation summaries were null and tier/component arrays empty. Full descriptions preserve pay text where advertised; the existing adapter does not separately project structured compensation. Future provider changes need renewed content review.
- Official auditing permits `legal.mistral.ai` only for company `mistral-ai` with official careers host `mistral.ai`. No other company gains that policy host; robots rules, public DNS checks, redirect/challenge rejection and existing bounds still apply.
- Audit the exact imported extraction/run against fresh official evidence. A discovery-only landing page and unreadable hosted inventory do not establish technical coverage. Do not fabricate visible links, empty selectors or reviewed traversal flags.
- Independent inventory, worldwide employer/entity/channel scope and access/display remain unresolved. A successful import cannot activate scheduling, absence-based closure or a verified coverage badge.
- Raw discovery, policies and HTML remain under ignored `backend/data/discovery/mistral-ai/`; actual ingestion snapshots stay with the database run. Compact evidence contains IDs, hashes, counts and blockers without advertisements or applicant data.

## Implementation and verification

PostgreSQL run `aa66d8d6-139d-48be-9a54-d7ef2920c237` succeeded at 16:11:42 UTC on 6 October 2026, importing 208 vacancies with complete enumeration, zero exclusions and no removal quarantine. One version-1 aggregate snapshot was stored. Public-feature backfill inspected and updated all 208 postings; database checks confirmed every feature/content hash matched.

Every stored description matched the complete sanitized native HTML and readable text; the shortest had 2,778 readable characters. Original job/application URLs, UUIDs, normalized titles, departments/teams, publication/employment fields and all distinct primary/secondary locations matched the captured aggregate.

The [compact audit](../backend/config/audit-evidence/mistral-ai.json), captured at 16:11:46 UTC and tied to the exact imported run, confirmed official board association but found no visible official posting IDs. All 208 feed IDs remain unreconciled. Both technical blockers—unreviewed official listing traversal and unavailable independent IDs—are retained; zero visible IDs does not mean the employer has no vacancies. Four policy/documentation pages were captured and hashed successfully. Persisted technical coverage is partial and access unreviewed; traditional scope/access review blockers remain.

Final `pnpm check` passed formatting, dependency boundaries, logo validation, zero-warning lint, strict types, 722 tests (687 backend and 35 frontend), contracts and both builds. The default suite skipped 28 PostgreSQL tests because `TEST_DATABASE_URL` was absent; the actual import/database verification above is separate evidence. New behavior tests exercise dotted Ashby registry validation, malformed identifiers, unchanged other-provider rules, board discovery without visible enumeration, and employer-specific legal-host boundaries.

Backlog validation confirmed 500 unique targets across 20 categories of 25, consistent with 70 runtime employers and 59 sources. The shortlist now has 50 configured employers, eight registered-only targets and 442 new candidates; all 993 local documentation links resolved. All first ten proposed queue targets have now been processed, including unresolved blockers; Cohere is the next proposed discovery target.

The rebuilt local API and ingestion worker restarted healthy. Checks through `http://localhost:8080` confirmed 208 searchable Mistral AI jobs, readable full details, original Ashby application URLs and the configured CORS origin. Public company metadata reports partial technical coverage with both unresolved inventory blockers and unreviewed access; source candidate/unscheduled. The initial smoke request during restart returned 502; the final check passed after both services became healthy. This verifies the local API/CORS path, not an actual Firefox UI session.

- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [audit plan](../backend/config/source-audits.json), [backlog](TECH_COMPANIES_500.json).
- [Ashby adapter and identifier pattern](../backend/src/infrastructure/adapters/ashby.ts), [registry validation](../backend/src/infrastructure/registry.ts), [registry tests](../backend/src/infrastructure/registry.test.ts), [official reconciliation](../backend/src/infrastructure/audits/reconcile.ts), [scoped audit hosts](../backend/src/infrastructure/audits/auditor.ts), [audit tests](../backend/src/infrastructure/audits/auditor.test.ts).
- [API metadata](../backend/src/api/app.test.ts), [wave selection](../backend/src/cli/select-sources.test.ts), [audit rules](AUDITING.md), [automatic coverage](AUTOMATIC_COVERAGE.md), [Wave C](WAVE_C.md), [quality gates](QUALITY.md).
