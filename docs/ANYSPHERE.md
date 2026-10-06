# Decision: Anysphere (Cursor) Ashby source and publication gate

**Status:** Public source configured and extraction validated; full-description publication access-blocked. No jobs imported. Recorded 6 October 2026, Europe/Amsterdam.

## Discovery and rationale

The [official Cursor careers page](https://cursor.com/careers) exposes 132 native vacancy links and embeds canonical posting/application URLs for [Ashby board cursor](https://jobs.ashbyhq.com/cursor). Its public version-1 aggregate advertises 132 listed postings with full descriptions and native UUIDs. All 132 embedded UUIDs match the independently retrieved aggregate. This establishes source association and a useful discovery comparison; embedded URLs do not establish the audit's visible per-posting inventory. Native title slugs must not be equated to immutable UUIDs by title similarity or matching counts.

The [terms](https://cursor.com/terms-of-service), dated 3 September 2026, identify Anysphere, Inc., define the Service to include its website, and restrict harvesting, scraping or extraction in section 1.5(viii). Register the source behind the existing access/display publication gate pending authorization for this employer. This records an application publication condition rather than supplying legal clearance. Earlier local authorization for Cohere does not approve Cursor or constitute employer consent. Robots accessibility, embedded provider data and public API documentation alone do not approve description display.

The [privacy policy](https://cursor.com/privacy) and terms identify Anysphere; the recruitment page also names Anysphere, Inc. Retain stable employer ID `anysphere` and display name `Anysphere (Cursor)`. Broader related brands, legal entities and hiring channels remain scope-review items. No inference about ownership is made from unrelated footer links or search snippets.

## Runtime invariants

- Company/source ID `anysphere`, provider `ashby`, board `cursor`, Wave C, shared local N/A logo pending vector review. Candidate source, scheduling disabled.
- Reuse the existing bounded public Ashby transport and adapter; no new provider, runtime host, credentials, private route or application submission.
- The blocked access/display plan rejects candidate publication after extraction and before atomic storage. Failed runs preserve previously published data and absence counters. No verification or scheduling flags are relaxed.
- Preserve native UUIDs, full descriptions, original URLs, locations, departments, dates and explicit employment/workplace labels if publication is subsequently authorized. The captured aggregate has no structured compensation tiers; pay mentioned inside descriptions remains advertisement content.
- Independent visible inventory reconciliation and employer scope review remain pending. No imported successful run exists, so technical coverage is partial and access blocked. Discovery evidence is not successful-run evidence.
- Raw public advertisements, HTML and local verification output remain in ignored backend data. Compact audit evidence retains policy hashes, native identifiers, counts and blockers without full descriptions.

## Implementation and verification

Local PostgreSQL run `d842e3fa-cdb8-42e7-a9db-96b2dd41fcf9` failed at the publication gate at 17:36:49 UTC on 6 October 2026. Read-only checks confirmed zero Cursor postings, zero matching features and zero successful snapshots. Independent extraction validated 132 listed jobs, zero generic exclusions, complete aggregate enumeration, native application paths and readable sanitized descriptions (minimum 434 characters). All 132 official embedded UUIDs equal the aggregate identity set; this comparison does not claim visible-link reconciliation.

The [compact audit](../backend/config/audit-evidence/anysphere.json), captured at 17:36:52 UTC, confirmed employer board association and captured terms, privacy and Ashby API documentation with robots and content hashes. Its technical result remains partial: listing traversal is unreviewed, 132 feed IDs lack visible official identity mapping, and there is no imported run. Persisted access status is blocked with an empty successful-run binding.

Final `pnpm check` passed formatting, boundaries, logos, zero-warning lint, strict types, 754 tests (719 backend and 35 frontend), contracts and both builds. The default suite skipped 28 PostgreSQL tests without `TEST_DATABASE_URL`; the explicit failed-run/database checks above are separate evidence. API metadata and manual Wave C selection tests include the candidate source. The runtime registry now contains 74 companies and 63 sources; the 500-company shortlist has 54 configured targets, eight registered-only and 438 new candidates. Replit is the next discovery target.

The rebuilt local API and ingestion worker restarted healthy. Checks through `http://localhost:8080` confirmed the registered company, candidate scheduling disabled, latest run failed and zero published Cursor jobs. Company status is blocked; the public technical badge remains pending with access unreviewed because no successful source run exists, rather than presenting the discovery audit as imported-run coverage. The stored audit separately records partial technical coverage and blocked access. The configured CORS origin is accepted and all 130 Perplexity jobs remain available. An actual Firefox UI session was not exercised. Backlog and link validation confirmed all 500 targets and 1,083 local documentation links.

- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [audit plan](../backend/config/source-audits.json), [backlog](TECH_COMPANIES_500.json).
- [Ashby adapter](../backend/src/infrastructure/adapters/ashby.ts), [publication validation](../backend/src/infrastructure/audits/validation.ts), [gate regression tests](../backend/src/infrastructure/audits/validation.test.ts), [atomic workflow](../backend/src/application/sync-source.ts).
- [API metadata test](../backend/src/api/app.test.ts), [manual selection test](../backend/src/cli/select-sources.test.ts), [audit rules](AUDITING.md), [Wave C](WAVE_C.md), [quality gates](QUALITY.md).
