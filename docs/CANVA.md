# Decision: Canva public SmartRecruiters postings

**Status:** Collection implemented using the existing SmartRecruiters adapter; 127 vacancies imported with full descriptions and job features. Independent employer coverage remains partial, access/display review pending, source candidate and unscheduled. Recorded 6 October 2026, Europe/Amsterdam.

## Discovery and rationale

The public Canva SmartRecruiters board advertised 127 postings during discovery. Its public detail supplied the complete role, qualification, benefits and other conditions in `companyDescription`, while `jobDescription`, `qualifications` and `additionalInformation` were empty. Reuse the existing adapter with an explicit Canva layout exception rather than treating the company field as generic boilerplate or importing search summaries as full descriptions. All supplied sections retain their original content and headings.

Canva's [official careers inventory](https://www.lifeatcanva.com/en/jobs/) and candidate privacy notice returned HTTP 403 challenges to Jobbely. The public [hosted board](https://careers.smartrecruiters.com/Canva) and Posting API were accessible without credentials. Search-tool rendering showed official native URLs containing the same numeric posting IDs; this is discovery evidence, not a successful independent runtime audit. No challenge is bypassed or alternate user agent substituted.

SmartRecruiters documents [public Posting API access](https://developers.smartrecruiters.com/docs/authentication) and [public-only list pagination](https://developers.smartrecruiters.com/reference/v1listpostings). Those documents do not approve Canva advertisement republication. Full-description display and employer/group scope remain separate review gates. Subsidiary brands are not declared fully covered or merged by title because they appear on this board.

## Invariants

- Company/source IDs are `canva`; provider is `smartrecruiters`, board `Canva`, exact endpoint `https://api.smartrecruiters.com/v1/companies/Canva/postings`. Registry validation binds each supported SmartRecruiters board to its own employer. Canva uses the existing local N/A logo pending vector review.
- Runtime transport adds only Canva's exact public JSON GET list and numeric detail routes under the existing SmartRecruiters host. Lists require `limit=100`, bounded numeric offset and `destination=PUBLIC`. Internal, filtered, application/configuration, POST and HTML routes remain denied.
- Existing complete pagination, unique numeric IDs/UUIDs, employer/reference/link checks, active/public details, full hydration, unsupported-section rejection, compensation handling and complete final inventory recheck remain in force. Any failure preserves prior listings and absence counters; no partial batch is published.
- For Canva, a readable complete advertisement in `companyDescription` can supply the role when the native role field is empty. Empty or script-only content cannot satisfy readability. ServiceNow still requires a readable separate role field. This reflects observed native field placement; readable text alone cannot prove editorial completeness if an employer truncates its advertisement.
- Canva's detail department, function and employment labels are authoritative. Posting `6000000001360382` consistently advertised Full-time in its summary and Contract in its detail; `6000000001287750` advertised Sales in its summary and Engineering in its detail. IDs, UUIDs, employer, title, date and location still match exactly. Final rechecks compare the complete validated summaries, including all labels, so summary drift still aborts. ServiceNow's summary/detail label equality remains unchanged.
- Audit identity extraction recognizes Canva's observed `/en/jobs/<numeric-id>/<slug>/` URLs and hosted board case variants. Location postings retain distinct IDs; neither equal titles nor equal counts establish equivalence.
- Imports do not approve scheduling, absence-based closure, full employer coverage or display rights. The audit plan remains pending with no fabricated reviewer or approval.
- Raw discovery/policy HTML stays under ignored `backend/data/discovery/canva/`; successful provider snapshots are stored with their database run. Compact evidence retains hashes, counts, identities and errors rather than full advertisements or upstream creator records.

## Implementation and verification

The initial two live attempts failed before publication on the observed summary/detail label discrepancies, with no successful provider snapshots stored. After preserving authoritative detail labels, PostgreSQL run `94bdc556-2724-4e09-84b9-e15c08df1045` succeeded from 14:28:14 to 14:30:26 UTC on 6 October 2026. It imported 127 vacancies with no exclusions, complete enumeration and no removal quarantine. Backfill updated all 127 public job-feature projections.

Database verification confirmed 127 active postings with matching feature/content hashes and 131 provider snapshots: two initial inventory pages, 127 full details and two final inventory pages. Every stored description contained the complete sanitized native company-description advertisement, with a minimum of 2,805 readable characters. Original posting/application URLs and detail employment labels matched their captured details, including Contract for posting `6000000001360382`. Detail function Engineering was retained for posting `6000000001287750`. Distinct identities were preserved without title-based merging.

The [compact audit](../backend/config/audit-evidence/canva.json), captured at 14:30:29 UTC and bound to that exact imported run, kept technical coverage partial and access unreviewed. The main official inventory and privacy notice returned HTTP 403; the hosted-board audit fetch failed despite its successful earlier discovery response. With no independent official IDs available, all 127 feed IDs remained unmatched; this does not establish that they are absent from the employer website. Public API documentation was captured without approving publication rights or scope.

Final `pnpm check` passed formatting, dependency boundaries, logo validation, zero-warning lint, types, 710 tests (675 backend and 35 frontend), contracts and both builds. The default suite skipped 28 PostgreSQL tests because `TEST_DATABASE_URL` was absent; the explicit live import/database checks above are separate evidence. The registry now contains 67 companies and 56 sources.

The rebuilt local API and ingestion worker restarted successfully. API checks at `http://localhost:8080` confirmed 127 searchable Canva jobs, readable full details and original application links, candidate/unscheduled metadata, partial technical coverage, unreviewed access and the configured CORS origin. Backlog validation confirmed all 500 unique targets across 20 categories of 25, with 47 configured shortlist employers, eight registered-only targets and 445 new candidates. All 927 local documentation links resolved.

- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [endpoint validation](../backend/src/infrastructure/registry.ts), [pending plan](../backend/config/source-audits.json), [backlog](TECH_COMPANIES_500.json).
- [Adapter](../backend/src/infrastructure/adapters/smartrecruiters.ts), [synthetic behavior tests](../backend/src/infrastructure/adapters/smartrecruiters.test.ts), [transport](../backend/src/infrastructure/http.ts), [network rejection tests](../backend/src/infrastructure/http.test.ts), [audit identities](../backend/src/infrastructure/audits/reconcile.ts), [API metadata](../backend/src/api/app.test.ts), [wave selection](../backend/src/cli/select-sources.test.ts).

```powershell
pnpm --filter @jobbely/backend run sync --company canva
pnpm --filter @jobbely/backend run audit --company canva
```

Sync requires PostgreSQL and hydrates every description at shared host pacing. Standalone audits fetch a new provider inventory; the wave worker audits exact imported evidence instead. Restart the API/worker after registry changes. See [SERVICENOW](SERVICENOW.md) for unchanged shared provider invariants, [AUDITING](AUDITING.md), [AUTOMATIC_COVERAGE](AUTOMATIC_COVERAGE.md), [LIFECYCLE](LIFECYCLE.md) and [QUALITY](QUALITY.md).
