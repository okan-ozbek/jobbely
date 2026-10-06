# Decision: Cohere local Ashby import and compensation retention

**Status:** Implemented; 130 jobs imported locally after explicit application-owner authorization. Independent inventory, employer scope and employer access/display review remain pending; source candidate and unscheduled. Recorded 6 October 2026, Europe/Amsterdam.

## Discovery and rationale

The [official careers page](https://cohere.com/careers) links directly to the [Ashby cohere board](https://jobs.ashbyhq.com/cohere). Its public version-1 aggregate supplied 130 listed postings with full descriptions, native UUIDs and original application links. Official and hosted HTML expose no visible posting IDs; the hosted JavaScript shell does not establish an independent inventory or zero vacancies.

The application owner explicitly requested enabling Cohere's local import/display after the initial publication block. Its audit plan now uses the existing pending-candidate manual import path. This authorization is recorded separately from employer permission: employer automated-retrieval and full-description display review remain unverified, with no fabricated consent, reviewer or approved-document records. Cohere's [terms](https://cohere.com/terms-of-use), including section 9's restrictions on supplied content and an older cohere.ai reference, remain captured evidence. The [privacy policy](https://cohere.com/privacy), [applicant privacy notice](https://cohere.com/applicant-privacy) and [Ashby API documentation](https://developers.ashbyhq.com/docs/public-job-posting-api) are also captured; accessible policies/feed do not independently establish display rights.

## Compensation completeness

The source includes 88 postings with public structured compensation outside `descriptionHtml`, comprising 234 geographic tiers. The Ashby adapter appends a Compensation section containing native aggregate summaries, all tier titles/summaries, component summaries with advertised currency/interval, and additional information where present. It performs no salary arithmetic, currency conversion or geographic range merging.

Native strings are escaped before shared HTML sanitization. Explicit `shouldDisplayCompensationOnJobPostings: false` suppresses compensation; an absent flag permits the documented public compensation response. Missing/null/empty compensation leaves descriptions unchanged. A salary-summary fallback handles responses without tiers. Malformed compensation fails the whole snapshot. One observed tier lacks a geographic title; its advertised range/components remain without an invented location.

The public API schema is unchanged: compensation is retained within the complete sanitized description. Native numeric components and metadata remain in source evidence. The generic adapter improvement applies to future Ashby refreshes; unrelated employers were not reimported for this change.

## Runtime invariants

- Stable company/source/board IDs are `cohere`, provider `ashby`, Wave C. The local N/A logo awaits vector review. Candidate source, scheduling disabled.
- Reuse `https://api.ashbyhq.com/posting-api/job-board/cohere?includeCompensation=true` through shared transport, pacing and limits. No new network host, credentials or application submission.
- Explicitly blocked access/display plans still reject candidate publication after extraction and before atomic storage. Cohere alone was changed from blocked to pending after local authorization; unrelated plans retain their gates. Failed runs preserve prior postings, absence counters and publication version.
- Pending employer scope/access/display reviews and unresolved independent inventory prevent verified scheduling or closure. The successful feed import establishes source enumeration, not worldwide employer completeness.
- The audit binds the exact successful import's snapshot and run ID, rather than a separate feed refresh. All 130 feed IDs remain independently unreconciled against official visible inventory.
- Raw advertisements, policies, discovery records and local checks remain under ignored backend data paths. Compact checked-in evidence contains hashes, identifiers, counts and unresolved blockers.

## Implementation and verification

PostgreSQL run `1227d5fe-680f-41e5-8b7d-fbe06f5c4bc8` succeeded at 17:02:53 UTC on 6 October 2026 with 130 listed vacancies, zero exclusions, complete source enumeration and no removal quarantine. Backfill created 130 matching job features. Database checks compared every active posting against the exact captured source snapshot, including full sanitized HTML/text, original native IDs, titles, application/employer links, locations, workplace/employment labels and publication timestamps. All feature content hashes match their postings. Every native description is preserved, with all 88 displayed compensation sections and 234 geographic tiers; the shortest stored description contains 4,702 characters.

The [compact audit](../backend/config/audit-evidence/cohere.json), captured at 17:02:57 UTC, establishes current official board association and captures four policy/documentation documents. It retains unresolved traversal and all 130 unmatched feed IDs. Persisted technical coverage is partial, access unreviewed, and its successful-run binding points to the import above. The earlier blocked run remains historical; it is not represented as successful evidence.

Final `pnpm check` passed formatting, dependency boundaries, logo validation, zero-warning lint, strict types, 730 tests (695 backend and 35 frontend), contracts and both builds. The default suite skipped 28 PostgreSQL tests because `TEST_DATABASE_URL` was absent; the successful import/database checks above are separate evidence. Compensation and blocked-publication regression tests remain passing without weakening their gates.

Backlog validation confirmed 500 unique targets across 20 categories of 25, consistent with 71 runtime employers and 60 sources. The shortlist has 51 configured employers, eight registered-only and 441 new candidates; all 1,016 local documentation links resolved. Hugging Face is the next proposed discovery target.

The rebuilt local API and ingestion worker restarted healthy. Checks through `http://localhost:8080` confirmed 130 Cohere jobs, full descriptions, advertised compensation on a paid posting, the latest successful run, partial technical coverage, unreviewed access and disabled candidate scheduling. The configured CORS origin was accepted and Mistral AI's existing 208 jobs remained available. This is a local API/CORS check; an actual Firefox UI session was not exercised.

- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [pending audit plan](../backend/config/source-audits.json), [backlog](TECH_COMPANIES_500.json).
- [Ashby adapter](../backend/src/infrastructure/adapters/ashby.ts), [adapter tests](../backend/src/infrastructure/adapters/adapters.test.ts), [publication validation](../backend/src/infrastructure/audits/validation.ts), [gate/preservation tests](../backend/src/infrastructure/audits/validation.test.ts), [atomic workflow](../backend/src/application/sync-source.ts).
- [API metadata](../backend/src/api/app.test.ts), [wave selection](../backend/src/cli/select-sources.test.ts), [audit rules](AUDITING.md), [automatic coverage](AUTOMATIC_COVERAGE.md), [Wave C](WAVE_C.md), [quality gates](QUALITY.md).
