# Decision: Anysphere (Cursor) local Ashby import

**Status:** 132 jobs imported locally after explicit application-owner authorization; source candidate and scheduled. Independent visible inventory and employer scope/access/display reviews remain pending. Recorded 6 October 2026, Europe/Amsterdam.

## Discovery and rationale

The [official Cursor careers page](https://cursor.com/careers) exposes 132 native vacancy links and embeds canonical posting/application URLs for [Ashby board cursor](https://jobs.ashbyhq.com/cursor). Its public version-1 aggregate advertises 132 listed postings with full descriptions and native UUIDs. All 132 embedded UUIDs match the independently retrieved aggregate. This establishes source association and a useful discovery comparison; embedded URLs do not establish the audit's visible per-posting inventory. Native title slugs must not be equated to immutable UUIDs by title similarity or matching counts.

The [terms](https://cursor.com/terms-of-service), dated 3 September 2026, identify Anysphere, Inc., define the Service to include its website and restrict harvesting, scraping or extraction in section 1.5(viii). The initial access/display plan blocked candidate publication. The application owner subsequently explicitly authorized Cursor local import/display, so its plan now uses the existing pending-candidate investigation path. This local authorization is separate from employer permission: no consent, reviewer or approved document records are fabricated. Terms, privacy and provider documentation remain captured evidence; public availability and robots accessibility alone do not establish description display rights.

The [privacy policy](https://cursor.com/privacy) and recruitment page also identify Anysphere, Inc. Retain stable employer ID `anysphere` and display name `Anysphere (Cursor)`. Broader related brands, legal entities and hiring channels remain scope-review items. No ownership inference is made from unrelated footer links or search snippets.

## Runtime invariants

- Company/source ID `anysphere`, provider `ashby`, board `cursor`, Wave C, shared local N/A logo pending vector review. Source remains candidate; scheduling is separately enabled by the application owner's all-source request. See [SCHEDULING.md](SCHEDULING.md).
- Reuse the existing bounded public Ashby transport and adapter; no new provider, runtime host, credentials, private route or application submission.
- Preserve native UUIDs, complete sanitized HTML/text, original URLs, locations, departments, dates and explicit employment/workplace labels. The captured aggregate has no structured compensation tiers; pay mentioned inside descriptions remains advertisement content.
- Exact-run technical coverage remains partial because visible native title-slug links lack a validated UUID mapping. The audit binds the successful stored run and extraction; discovery comparisons do not establish worldwide employer scope.
- Unrelated explicitly blocked access/display plans still reject candidate publication before atomic storage. Scheduling does not relax verified-source evidence, candidate closure eligibility or removal quarantine.
- Raw public advertisements, HTML and local verification output remain in ignored backend data. Compact checked-in audit evidence retains policy hashes, native identifiers, counts and blockers without full descriptions.

## Implementation and verification

The earlier run `d842e3fa-cdb8-42e7-a9db-96b2dd41fcf9` remains a historical publication-blocked failure, not successful evidence. After explicit authorization, PostgreSQL run `c525421c-bf55-4fb5-b613-29d448cf1274` succeeded at 17:45:40 UTC on 6 October 2026 with 132 listed jobs, zero generic exclusions, complete aggregate enumeration and no removal quarantine. Backfill created 132 matching features and the successful run retained one aggregate snapshot.

Database checks compared every active job with that exact successful snapshot: native UUIDs, complete sanitized HTML/text, original job/application URLs, titles, labels, locations and publication timestamps. Every matching feature hash equals its posting hash; the shortest stored description contains 434 characters. No structured pay tiers were advertised, so none was invented.

The [compact audit](../backend/config/audit-evidence/anysphere.json), captured at 17:45:44 UTC, establishes employer board association and retains terms/privacy/API document hashes. It binds the successful imported run; independent traversal and all 132 visible-link identity mappings remain unresolved. Persisted technical status is partial and access unreviewed. Local authorization does not invent employer approval or passing technical coverage.

The runtime registry contains 74 companies and 63 sources; the 500-company shortlist has 54 configured targets, eight registered-only and 438 new candidates. Replit is the next discovery target. Scheduling, final repository/database checks and deployment evidence are recorded in [SCHEDULING.md](SCHEDULING.md).

- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [audit plan](../backend/config/source-audits.json), [backlog](TECH_COMPANIES_500.json).
- [Ashby adapter](../backend/src/infrastructure/adapters/ashby.ts), [publication validation](../backend/src/infrastructure/audits/validation.ts), [gate regression tests](../backend/src/infrastructure/audits/validation.test.ts), [atomic workflow](../backend/src/application/sync-source.ts).
- [API metadata test](../backend/src/api/app.test.ts), [manual selection test](../backend/src/cli/select-sources.test.ts), [audit rules](AUDITING.md), [Wave C](WAVE_C.md), [quality gates](QUALITY.md).
