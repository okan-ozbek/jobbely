# Decision: Runway public Ashby import and unresolved hiring channels

**Status:** Implemented; 45 jobs imported locally with full descriptions, native compensation and matching features. Source candidate and scheduled; technical employer coverage partial and scope/access/display reviews pending. Recorded 7 October 2026, Europe/Amsterdam.

## Discovery and rationale

The legacy `runwayml.com/careers` entry redirects to the [canonical careers page](https://runway.com/careers). It visibly links 45 distinct posting UUIDs on [Ashby board runway-ml](https://jobs.ashbyhq.com/runway-ml). All 45 match the public version-1 aggregate in both directions. The existing adapter supplies complete descriptions and original application links, with 44 displayed compensation sections and 44 geographic tiers; zero non-vacancy entries were excluded.

The same careers page advertises four Runway Studios roles: Animator, VFX Artist, Screenwriter and Creative Producer. They share one [Google form](https://forms.gle/HEKs8puDzxZaSSsV6). A complete compatible description feed and distinct stable posting identities have not been established, so these advertisements are recorded as an unresolved hiring channel rather than manufactured vacancies or silently omitted coverage. The footer's [Talent Network](https://talent.runwayml.com/) also needs employer-hiring versus creative-network scope review. Neither channel is connected to a source; matching the Ashby inventory does not establish complete employer coverage. No applications or forms were submitted.

The application owner's continuing onboarding request authorizes local integration/display, and the earlier all-source instruction enables scheduled refreshes. Captured [terms](https://runway.com/terms-of-use), dated 15 September 2026, include section 1.3 website scraping/download and content republication restrictions. [Privacy](https://runway.com/privacy-policy) and [Ashby API documentation](https://developers.ashbyhq.com/docs/public-job-posting-api) are retained alongside policy/robots hashes as unreviewed evidence. Employer retrieval/display permission remains unverified; no employer consent, reviewer or approved policy hash is invented. Public availability and robots permission do not establish republication rights. Existing explicitly blocked employer plans remain effective.

## Runtime invariants

- Stable company/source ID `runway`, Ashby board `runway-ml`, Wave C, canonical careers URL and shared N/A logo pending vector review. Scheduling follows [SCHEDULING.md](SCHEDULING.md) independently of verification.
- Reuse `https://api.ashbyhq.com/posting-api/job-board/runway-ml?includeCompensation=true` through the existing adapter and bounded transport. No new adapter, private API, credentials, transport allowlist or public API schema is required.
- Preserve full sanitized HTML/text, posting UUIDs, titles, original job/application URLs, department/team, primary/secondary locations, employment/workplace labels, publication dates and native compensation. Unknown optional values remain unknown; no pay ranges are calculated.
- Official visible full UUID links provide ATS inventory; the hosted shell supplies discovery only. The Studios form and Talent Network stay pending channels without source IDs, preventing a whole-employer coverage checkmark.
- Audit uses the exact successful extraction and run ID without another feed fetch. Technical matching, employer approval and closure remain distinct. Scheduled candidate refreshes cannot advance missing counters or close absent jobs; blocked-plan and removal-quarantine gates remain unchanged.
- Raw descriptions, discovery HTML, policies and diagnostics remain in ignored backend data. Checked-in evidence contains compact identities, hashes, counts and limitations.

## Implementation and verification

PostgreSQL run `3fc91754-2a8c-4bfa-963a-739edbaff2f8` succeeded at 22:03:23 UTC on 6 October 2026 (7 October locally) with 45 vacancies, zero exclusions, complete aggregate enumeration and no removal quarantine. Backfill created 45 matching features. The run retains one aggregate snapshot. Database verification compared all active postings against that exact snapshot: full sanitized descriptions, identities and URLs, titles, department/team, locations, employment/workplace labels, publication dates, all 44 displayed compensation sections and tiers. Every feature hash matches its posting; the shortest description contains 3,860 characters.

The [compact audit](../backend/config/audit-evidence/runway.json) matches all 45 official ATS UUIDs without missing IDs in either direction. The audit remains blocked by the two unconnected channels, with persisted technical coverage **partial** and access **unreviewed**. This is separate from the successful complete Ashby import. Employer scope/access/display and manual traversal reviews remain pending; no worldwide legal-entity coverage is claimed.

API metadata and Wave C selection checks include Runway. The registry has 78 companies and 67 scheduled candidate sources across 64 configured companies; Wave C has 23 sources. The 500-company backlog has 58 configured targets, eight registered-only and 434 new candidates. Supabase is the next proposed discovery target.

Root `pnpm check` passed formatting, boundaries, logos, zero-warning lint, strict types, 764 tests (729 backend and 35 frontend), contracts and both builds. The default environment skipped 28 PostgreSQL tests without `TEST_DATABASE_URL`; the successful import and exact-snapshot database verification above are separate live evidence. No public schema changes were required. Backlog validation confirmed 500 unique names/slugs across 20 categories of 25 and resolved 1,202 local Markdown links.

The rebuilt local API and ingestion worker restarted healthy. API checks through `http://localhost:8080` confirmed 45 Runway jobs, complete detail HTML/text, native compensation and original Ashby application links, with partial coverage and unreviewed access. All 67 source flags remain scheduled/candidate across 64 configured companies. PostgreSQL inspection confirmed one exclusive `sync-waves` cron at `0 */12 * * *`, UTC, with no competing per-source cron entries. ElevenLabs' 137 jobs remain available. The configured browser origin is accepted; an actual Firefox UI session was not exercised. This employer import and scheduling check do not establish a successful fresh refresh for the entire cohort.

- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [audit plan](../backend/config/source-audits.json), [backlog](TECH_COMPANIES_500.json).
- [Ashby adapter](../backend/src/infrastructure/adapters/ashby.ts), [native identity parser](../backend/src/infrastructure/audits/reconcile.ts), [atomic workflow](../backend/src/application/sync-source.ts), [audit workflow](../backend/src/infrastructure/audits/wave-refresh.ts).
- [API metadata](../backend/src/api/app.test.ts), [wave selection](../backend/src/cli/select-sources.test.ts), [audit rules](AUDITING.md), [Wave C](WAVE_C.md), [quality checks](QUALITY.md).
