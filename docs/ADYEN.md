# Decision: Adyen public Greenhouse board

**Status:** Implemented using the existing Greenhouse adapter; 228 vacancies imported with full descriptions and job features. Technical coverage remains partial, access/display review pending, source candidate and unscheduled. Created 6 October 2026, Europe/Amsterdam.

## Decision and rationale

Reuse the public Greenhouse Job Board API for Adyen instead of introducing a native scraper. The employer's public careers client explicitly uses `https://boards-api.greenhouse.io/v1/boards/adyen`, and its [official vacancy](https://careers.adyen.com/vacancies/8226137-people-technology-application-engineer) links to the same [hosted board](https://job-boards.greenhouse.io/adyen). Public board metadata and all 228 discovery records identified Adyen. That evidence establishes the observed board association, without approving employer-wide scope or description republication.

[Greenhouse's documentation](https://docs.greenhouse.io/job-board.html) states that GET job-board data is public and documents `content=true` for the full concatenated advertisement, department and office fields. The aggregate supplies complete descriptions, so separate per-job application/detail requests are unnecessary. Keep the existing extraction, sanitization, classification, storage and job-feature boundaries.

## Invariants and limits

- Company, source and board IDs are `adyen`; provider is `greenhouse`. The company joins Wave C as a backlog expansion, with a local N/A logo pending vector review. It remains candidate and unscheduled; imports cannot reconcile absence-based closure.
- Request the existing adapter's unfiltered `jobs?content=true` endpoint through shared HTTPS transport, pacing, retry, redirect and body-size limits. No new ingestion destination, credentials, application submission or internal API is added.
- Validate every record and compare array length with the advertised numeric total before publication. Existing explicit prospect/talent-pool exclusions apply; distinct posting IDs remain distinct even when titles match. The shared use case rejects duplicate IDs, unreadable descriptions and unsafe content before atomic publication.
- Preserve provider posting/application URLs, complete advertisement content, department labels and advertised locations. Nullable office locations use their office name through the existing mapping. Workplace, employment and publication timestamp remain unknown in the current Greenhouse canonical mapping; raw evidence retains upstream fields. Do not infer on-site work from Adyen's general office policy or use `updated_at` as a publication date.
- The observed feed contained no separate enabled AI disclaimers or prospect records. This is dated evidence, not a promise about future payloads. Provider changes still require validation against the existing adapter's content contract.
- The main careers inventory renders a client shell with zero visible jobs in captured HTML. It is not an explicit empty inventory. The hosted board exposes 50 unique IDs on its first page and has interactive pagination; the adapter's complete aggregate does not independently prove visible-board traversal.
- Auditing recognizes enabled icon-only “Next page” controls through their accessibility label and withholds traversal verification. Disabled controls at the end of an inventory do not demand another page. No employer script is executed by collection or auditing.
- The official vacancy in the audit plan establishes employer attribution only; it is not an exhaustive listing page. It can disappear when that job closes and must then be replaced with current evidence. Neither titles nor sampled vacancy pages can account for unmatched inventory IDs.
- Adyen's [disclaimer](https://www.adyen.com/policies-and-disclaimer/disclaimer) is fetched only when the company is `adyen` with the official `careers.adyen.com` host. Policy hashes and public API documentation are evidence for review, not automatic access/display approval.

## Implementation and verification

The final successful PostgreSQL run `a0dabcf3-589f-4930-b0ed-8cf5a573dcc0` ran from 13:55:40.209 to 13:55:40.753 UTC on 6 October 2026. It stored 228 active vacancies, no exclusions, and one full-content aggregate snapshot fetched at 13:55:40.526 UTC. The earlier onboarding import created all 228 job-feature projections. Repeating the refresh after the pagination correction preserved the same posting IDs and first-observation timestamps, required no feature updates and retained 228 content-version records. Explicit database checks confirmed every native posting ID, original board application URL, current feature content hash and a readable full description for every vacancy.

The [compact exact-run audit](../backend/config/audit-evidence/adyen.json), observed at 13:55:43 UTC and bound to that final run, captured all three official pages and both policy documents successfully. It established the official board link and matched all 50 visible unique first-page IDs, with no official IDs missing from the feed and no invalid details. Interactive next-page traversal remained unsupported and 178 imported IDs were unmatched in the captured visible inventory. These IDs are not claimed to be absent from the actual complete website. Technical coverage stayed partial and access unreviewed; no scope/display approval, scheduling or closure was enabled.

Final `pnpm check` passed formatting, dependency boundaries, logo validation, zero-warning lint, types, 695 tests (660 backend and 35 frontend), contracts and both builds. The default run skipped 28 PostgreSQL suite tests because `TEST_DATABASE_URL` was absent; the actual import and explicit database checks above are separate evidence. Backlog validation confirmed 500 unique names/slugs across 20 sectors of 25, matching the updated runtime registry of 65 companies and 54 source boards.

- [Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [pending audit plan](../backend/config/source-audits.json), [backlog](TECH_COMPANIES_500.json).
- [Existing Greenhouse adapter](../backend/src/infrastructure/adapters/greenhouse.ts), [ingestion use case](../backend/src/application/sync-source.ts), [audit host restrictions](../backend/src/infrastructure/audits/auditor.ts), [pagination inspection](../backend/src/infrastructure/audits/reconcile.ts).
- [Adapter tests](../backend/src/infrastructure/adapters/adapters.test.ts), [audit regression tests](../backend/src/infrastructure/audits/auditor.test.ts), [API metadata](../backend/src/api/app.test.ts), [wave selection](../backend/src/cli/select-sources.test.ts).

```powershell
pnpm --filter @jobbely/backend run sync --company adyen
pnpm --filter @jobbely/backend run audit --company adyen
```

Manual sync requires PostgreSQL. A standalone audit retrieves another provider snapshot; the wave worker audits the exact imported extraction and run ID. Raw discovery HTML, public scripts, policies and diagnostics stay in ignored `backend/data/discovery/adyen/`; successful provider evidence is stored with its atomic database run. Restart API/worker processes after registry changes. Access/display review, scope and source activation remain separate gates. See [AUDITING](AUDITING.md), [AUTOMATIC_COVERAGE](AUTOMATIC_COVERAGE.md), [WAVE_C](WAVE_C.md) and [QUALITY](QUALITY.md).
