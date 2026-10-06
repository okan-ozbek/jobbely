# Decision: Vercel public Greenhouse board

**Status:** Implemented with the existing Greenhouse adapter; 83 vacancies imported with full descriptions and matching job features. Technical coverage verified for the observed official inventory; employer-scope/access/display reviews remain pending, source candidate and unscheduled. Recorded 6 October 2026, Europe/Amsterdam.

## Discovery and rationale

The [official careers page](https://vercel.com/careers) exposes 83 distinct native vacancy links in unfiltered HTML. Their final numeric IDs match every posting in the public Greenhouse `vercel` aggregate. A [sample native detail](https://vercel.com/careers/account-executive-commercial-6136160004) embeds the same posting's original Greenhouse URL, establishing the observed board association independently of provider naming. Cached search counts varied; the integration uses the contemporaneous direct responses.

Reuse Greenhouse's existing full-content endpoint rather than introducing another native collector. [Provider documentation](https://docs.greenhouse.io/job-board.html) describes public job-board retrieval and optional content. Its legacy documentation host redirects to this canonical host. Vercel's legacy privacy-policy URL redirects to the [privacy notice](https://vercel.com/legal/privacy-notice); the audit uses the direct canonical URL and does not follow redirects.

The [terms](https://vercel.com/legal/terms), privacy notice and [job applicant privacy notice](https://vercel.com/legal/job-applicant-privacy-notice) were captured and hashed. Their availability and the public API contract do not approve full-description republication. Access/display reviews remain pending without invented consent or reviewer.

## Invariants and limits

- Stable company/source/board IDs are `vercel`; provider is `greenhouse`, in Wave C. Use the existing local N/A logo pending vector review. The source remains candidate and unscheduled.
- Fetch `https://boards-api.greenhouse.io/v1/boards/vercel/jobs?content=true` through shared HTTPS transport, response limits, pacing and retries. No new ingestion host, native detail collection or application request is introduced.
- Preserve numeric posting IDs, titles, complete sanitized descriptions, departments, distinct primary/office locations and original employer/application URLs. The existing adapter checks advertised total, applies non-vacancy exclusions, and the shared workflow rejects duplicate IDs and unreadable descriptions before atomic publication. This run excluded zero postings.
- Greenhouse's entity-encoded HTML is decoded and sanitized by the existing shared preparation. Full stored HTML and readable text must match that preparation of the complete native content, including benefits, pay and disclosure sections where advertised.
- The existing adapter leaves canonical employment/workplace unknown and publication date null. Native `updated_at`, `first_published`, requisition IDs and metadata remain in the captured raw snapshot; no date or employment inference is added for this employer.
- Official reconciliation recognizes only `vercel.com/careers/<slug>-<numeric-id>`, with an optional trailing slash, as a native posting identity on `greenhouse:vercel`. Visible links supply enumeration; embedded links establish board discovery only. Equal titles do not merge distinct IDs. Other hosts and malformed/application paths do not supply Vercel posting IDs.
- Audit fresh official HTML against the exact imported extraction/run in both directions. The official inventory contained no unresolved pagination controls during this audit. Its manual `complete` flag and scope approval remain unset; the automatic technical result is independent of these review flags.
- Technical verification covers the observed configured inventory, not every undiscovered subsidiary/entity/channel. It neither approves access/display nor enables scheduling or absence-based closure.
- Raw HTML, policies and discovery diagnostics stay under ignored `backend/data/discovery/vercel/`. The database stores the actual successful aggregate; compact evidence contains identities, hashes, counts and blockers without full advertisements or applicant data.

## Implementation and verification

PostgreSQL run `0adb7640-f848-4bb9-9fbd-a14a3df33371` succeeded at 16:02:09 UTC on 6 October 2026 with 83 vacancies, zero exclusions, complete enumeration and no removal quarantine. One aggregate snapshot was stored. Public-feature backfill inspected and updated all 83 postings.

The [compact audit](../backend/config/audit-evidence/vercel.json), captured at 16:02:12 UTC and bound to that exact imported run, matched all 83 visible native official IDs to all 83 imported IDs. Both unmatched sets were empty; attribution, descriptions and traversal passed with no technical blockers. All four policy/documentation documents were captured and hashed. Persisted technical coverage is verified and access unreviewed; traditional scope/access review blockers remain and scheduling stays disabled.

Database verification confirmed all 83 active postings had matching feature/content hashes. Every stored description matched the complete sanitized native HTML and readable text; the shortest contained 3,217 readable characters. Original URLs, numeric IDs, normalized titles, departments and distinct primary/office locations matched the captured aggregate. Canonical unknown employment/workplace and null publication dates remained explicit.

Final `pnpm check` passed formatting, dependency boundaries, logo validation, zero-warning lint, strict types, 711 tests (676 backend and 35 frontend), contracts and both builds. The default suite skipped 28 PostgreSQL tests because `TEST_DATABASE_URL` was absent; the actual import/database verification above is separate evidence. The new audit behavior test covers native IDs, duplicate links, equal titles, embedded-link exclusion, unrelated hosts, malformed paths and an optional trailing slash.

Backlog validation confirmed 500 unique targets across 20 categories of 25, consistent with 69 runtime employers and 58 sources. The shortlist now contains 49 configured employers, eight registered-only targets and 443 new candidates; all 969 local documentation links resolved. The next queue target is Mistral AI.

The rebuilt local API and ingestion worker restarted healthy. Checks through `http://localhost:8080` confirmed 83 searchable Vercel jobs, readable full details, original Greenhouse application links and the configured CORS origin. Public metadata reports healthy status, verified technical coverage with no technical blockers and unreviewed access; the source remains candidate/unscheduled. This was an API/CORS check, not an actual Firefox UI session.

- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [pending audit plan](../backend/config/source-audits.json), [backlog](TECH_COMPANIES_500.json).
- [Existing adapter](../backend/src/infrastructure/adapters/greenhouse.ts), [shared preparation](../backend/src/infrastructure/html.ts), [identity reconciliation](../backend/src/infrastructure/audits/reconcile.ts), [audit behavior tests](../backend/src/infrastructure/audits/auditor.test.ts), [API metadata](../backend/src/api/app.test.ts), [manual wave selection](../backend/src/cli/select-sources.test.ts).
- [Audit rules](AUDITING.md), [automatic coverage](AUTOMATIC_COVERAGE.md), [Wave C](WAVE_C.md), [quality gates](QUALITY.md).
