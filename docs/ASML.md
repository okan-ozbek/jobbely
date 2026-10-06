# Decision: ASML full-description publication gate

**Status:** Candidate registered behind an explicit publication/source gate; vacancy collection is not implemented. Recorded 6 October 2026, Europe/Amsterdam.

## Discovery and rationale

The official [careers search](https://www.asml.com/en/careers/find-your-job) was accessible as HTTP 200, but its captured HTML rendered a client search shell with no visible vacancy inventory. That does not establish zero vacancies. Its public Next.js hydration contains search component configuration, rather than a complete validated posting array. Search-engine copies of older filtered pages and job counts are not current exhaustive inventory evidence.

ASML's [published terms](https://www.asml.com/en/terms-of-use) restrict copying/republication of website material without prior written consent. No such permission or authorized feed with full-description display rights is established for Jobbely. Because the app stores and displays full descriptions, register an explicit failure gate before adding a collector. This records a concrete publication condition; it does not assert that all public browsing is prohibited or supply legal clearance.

The captured robots file permits the bare careers entry point but disallows several job/filter query parameters and older platform paths. Robots accessibility does not approve description republication. A guessed legacy `asml.wd3.myworkdayjobs.com/ASML` entry returned HTTP 404, and a previously indexed native job page also returned HTTP 404 to direct discovery. Neither is configured as a functioning Workday source, and neither proves that the employer has no current jobs. The actual current provider and complete unfiltered traversal remain unresolved.

## Invariants

- Stable company/source/board IDs are `asml`; provider `asml` identifies an explicit native source gate, not a working scraper or Workday adapter. Its exact recorded endpoint is the observed official careers search page.
- Registry validation binds that provider to the ASML company, board and endpoint. The source remains `candidate`, `scheduled: false`, in Wave C. It uses the existing local N/A logo pending vector review.
- Extraction throws an actionable full-description publication blocker before making GET, POST or HTML requests. ASML is not added to the runtime ingestion destination allowlist.
- Failed runs preserve prior listings, dataset publication version, successful raw snapshots and absence counters through the existing ingestion workflow. They cannot establish successful enumeration, source health, job features, scheduling or closure.
- The audit can capture the official careers page, robots and terms through its existing same-employer transport. Scope stays pending; access and display are blocked, without an invented approval/reviewer. No verified empty selector is configured for the client shell.
- Raw discovery HTML, public scripts and diagnostics stay under ignored `backend/data/discovery/asml/`. Durable audit evidence contains hashes, links, errors and counters, without copied job descriptions or applicant data.

## Implementation and verification

At 14:08:15 UTC on 6 October, the canonical PostgreSQL ingestion workflow recorded failed run `ddbd2017-26ff-4cca-b005-1a72f07642f7` with the explicit publication blocker and `enumerationComplete: false`. Database checks confirmed no ASML postings, provider snapshots or job-feature projections. Those zero stored counters describe an unavailable integration, not a verified zero-vacancy employer.

The [compact audit](../backend/config/audit-evidence/asml.json), observed at 14:08:17 UTC, captured the official search page and current terms/robots successfully. It saved technical coverage as partial and access as blocked, without any imported-run binding or complete inventory claim. The gate's tests also use synthetic prior postings to verify preservation of their content and absence counters, failed-run state and unchanged dataset publication version.

The restarted local API reports ASML's overall status as blocked, its candidate source as unscheduled with a failed latest run, and zero stored jobs. Public technical verification remains pending and its access projection unreviewed: the existing catalog requires a successful current import binding before publishing audit verification. The saved plan and audit still record the publication blocker. Responses accept the configured `http://localhost:8080` origin.

Final `pnpm check` passed formatting, dependency boundaries, logo validation, zero-warning lint, types, 697 tests (662 backend and 35 frontend), contracts and both builds. The default run skipped 28 PostgreSQL suite tests because `TEST_DATABASE_URL` was absent; the explicit local failed-run/database checks above are separate evidence. Backlog validation confirmed 500 unique names/slugs across 20 sectors of 25, matching the updated registry of 66 companies and 55 source entries.

- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [exact endpoint validation](../backend/src/infrastructure/registry.ts), [pending/blocked audit plan](../backend/config/source-audits.json), [backlog](TECH_COMPANIES_500.json).
- [Adapter factory](../backend/src/infrastructure/adapters/factory.ts), [existing failure adapter](../backend/src/infrastructure/adapters/restricted.ts), [native gate tests](../backend/src/infrastructure/adapters/native.test.ts), [prior-listing preservation](../backend/src/application/sync-source.test.ts), [API metadata](../backend/src/api/app.test.ts), [wave selection](../backend/src/cli/select-sources.test.ts).

```powershell
pnpm --filter @jobbely/backend run sync --company asml
pnpm --filter @jobbely/backend run audit --company asml
```

Both commands are expected to report blockers; sync requires PostgreSQL. Before replacing the gate, establish permitted full-description display through actual consent or an authorized feed, rediscover the current source, validate complete unfiltered traversal and readable descriptions, and reconcile employer/posting identities independently. A links-only alternative would require an explicit product/API change because the current application promises full descriptions. See [AUDITING](AUDITING.md), [AUTOMATIC_COVERAGE](AUTOMATIC_COVERAGE.md), [WAVE_C](WAVE_C.md) and [QUALITY](QUALITY.md).
