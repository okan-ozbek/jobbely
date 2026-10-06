# Decision: Wave C priority native sources

**Status:** Original five priorities configured, with Atlassian, Shopify, HubSpot, ServiceNow, Adyen, ASML, Canva, Notion, Vercel, Mistral AI, Cohere, Hugging Face, Perplexity and Anysphere (Cursor) added as backlog expansions on 6 October 2026. Netflix fully imported; Apple/Amazon full imports blocked by live inventory inconsistencies; Meta/Google access-blocked; Atlassian description-blocked. Shopify's implementation and live results are recorded separately. HubSpot is configured behind an unavailable-source gate. Original evidence recorded 1 October 2026, Europe/Amsterdam.

## Scope and rationale

Start with Meta, Apple, Netflix, Google and Amazon. Seven other Wave C companies remain outside this first batch. On 1 October 2026, Microsoft, Oracle, X (Twitter), IBM, JPMorgan Chase, Goldman Sachs and ABN AMRO were deferred to [Wave D](WAVE_D.md); none had configured sources. Preserve the existing extraction port, native identifiers, classification strategies and atomic publication workflow. Native differences stay in infrastructure adapters; no AI, browser execution, credentials or application submission is required.

| Company | Integration            | Boundary                                                                        |
| ------- | ---------------------- | ------------------------------------------------------------------------------- |
| Meta    | Access gate            | Express written permission required for automated collection                    |
| Apple   | Public structured HTML | Search and complete details; internal JSON API is unauthorized and unused       |
| Netflix | Eightfold JSON         | Explicit Netflix domain; every posting receives full detail hydration           |
| Google  | Access gate            | Paginated career searches disallowed; no exhaustive authorized feed established |
| Amazon  | Native JSON            | Full descriptions; category partitions exhaust the capped search                |

[Meta's robots policy](https://www.metacareers.com/robots.txt) states its written-permission requirement. [Google's robots policy](https://www.google.com/robots.txt) disallows paginated career result URLs. Google's accessible first page does not establish complete coverage. Restricted adapters make no requests and record explicit failures; they do not publish sample pages or report zero vacancies. An authorized feed needs a replacement adapter and access review, not a verification flag change.

## Apple: public structured HTML

Apple's bare search redirects to a USA-filtered view. Send `location=` explicitly to request all locations and reject populated native filters. Use the documented `locationAsc` sort to reduce changes caused by refreshed posting dates; the response must echo that sort and the requested page. Totals must remain consistent and native posting IDs distinct. A first-page recheck rejects traversal drift. This ordering does not eliminate upstream changes; repeated or shifted inventories still fail.

Search summaries are insufficient. Hydrate every public detail page and match the internal requisition/position identity and native public `jobNumber`. Store the search posting ID with its location suffix; several postings can share one internal requisition. Managed retail `PIPE-` identities use a numeric public URL while retaining their native stored ID. Preserve summary, duties, qualifications, education, additional requirements and footer content in the selected locale, including pay/benefits when supplied. Retain team labels and locations. A missing remote flag remains unknown; the native `RETAIL` job type is not an employment type. Advertised ongoing retail roles remain included unless the existing explicit title policy excludes them.

Decode only the literal string in `window.__staticRouterHydrationData = JSON.parse(...)`, then validate its JSON schema. Never evaluate upstream scripts. Missing, duplicate or malformed hydration data fails the source. The unauthorized `/api/v1` routes are outside the fetch allowlist. Auditing maps managed retail public IDs to their stored `PIPE-` identity through validated extraction records; title slugs are not identities. Encode international title slugs as URL segments.

## Netflix: Eightfold hydration

Search `/api/apply/v2/jobs` with the explicit Netflix domain, offset and requested page size. Advance by the actual received count. Validate totals, identities and private/public state. Repeated or prematurely ended pages fail. Every listing receives a native detail request, exact ID match and same-origin canonical link validation. Retain complete descriptions, departments, secondary locations and source workplace labels. The canonical posting page is the application entry point.

This adapter supports the discovered Netflix deployment only. Additional Eightfold employers need explicit endpoint/domain configuration and validation. Netflix House and other linked hiring channels remain scope-review items.

## Amazon: uncapping native search

The native `/en/search.json` response caps hits at 10,000 but exposes category facet counts beyond that cap. Partition capped inventories using exact native category labels, not inferred slugs or keyword samples. Each single-valued category must be below the cap and exhaust its count. Reject ignored filters, overlap, repeated IDs, early empty pages, count drift and changed final facets. The final identity count must equal the facet sum.

The JSON feed includes full descriptions and both qualification sections, so additional detail requests are unnecessary. Store the native posting number `id_icims`, including `SF` hiring postings, and retain categories and serialized secondary locations. Native posting URLs can omit the title slug; account links can use `account.amazon.jobs` or `account.amazon.com`. Native `HVH` records use the explicit `hvr-amazon.my.site.com/JobDetails` path: its `reqid` must exactly match the captured native internal ID and `isapply` must be `1`. Auditing maps this requisition to the public `SF` posting ID. These link allowances do not authorize fetching account/application pages. Missing employment/workplace information remains unknown. This feed alone does not establish coverage of separate hourly hiring sites or every subsidiary.

## Transport and publication

`HtmlTransport.getHtml` extends the shared bounded transport for Apple's public routes. JSON and HTML share pacing, retries, timeout, size limits and host queues. Native fetch hosts and paths are explicit. Redirects, internal APIs and account/application writes remain rejected. Raw HTML is retained as evidence; structured descriptions pass through the existing sanitizer.

Native extraction has a two-hour elapsed budget. Apple and Netflix cap inventory at 10,000 and search at 1,000 pages; Amazon allows 2,000 requests. At one request per host per second, Apple's first full-detail import can take over 100 minutes. Enumeration with sampled details cannot publish a complete snapshot.

Large inventories use parameterized posting batches of 250, version batches of 250 and raw snapshot batches of ten. All batches remain inside the same transaction, ownership check and dataset-version publication. A later failure rolls back earlier batches. See [STORAGE.md](STORAGE.md) and [INGESTION.md](INGESTION.md).

## Operator commands and audit boundary

```powershell
pnpm sync:wave-c
pnpm audit:wave-c
pnpm --filter @jobbely/backend run sync --company netflix
pnpm --filter @jobbely/backend run sync --company apple
```

Wave C commands select the original five priorities plus [Atlassian](ATLASSIAN.md), [Shopify](SHOPIFY.md), [HubSpot](HUBSPOT.md), [ServiceNow](SERVICENOW.md), [Adyen](ADYEN.md), [ASML](ASML.md), [Canva](CANVA.md), [Notion](NOTION.md), [Vercel](VERCEL.md), [Mistral AI](MISTRAL_AI.md), [Cohere](COHERE.md), [Hugging Face](HUGGING_FACE.md), [Perplexity](PERPLEXITY.md) and [Anysphere (Cursor)](ANYSPHERE.md), added from the 500-company backlog on 6 October 2026. They do not select every planned Wave C employer. Sync continues after source failures and returns a nonzero exit code for blockers. All nineteen remain candidate and unscheduled; scope/access reviews are incomplete and ASML full-description display is blocked. Atlassian's native aggregate currently lacks a required job description and cannot publish a complete snapshot. Shopify reads public listing/detail hydration while independent visible-inventory coverage remains pending. HubSpot currently fails explicitly because its public careers service returned listing/detail errors; no collector or jobs were published. ServiceNow adds public SmartRecruiters pagination and full detail hydration, with independent scope/access/coverage still pending. Adyen reuses Greenhouse and imported 228 vacancies; its independent audit matched 50 visible IDs while interactive hosted-board pagination left 178 unmatched. ASML is configured behind a publication gate requiring actual consent or an authorized full-description feed; no collector or jobs were published. Canva reuses SmartRecruiters with its observed whole-advertisement field and detail employment labels; official inventory retrieval remains challenged. Notion reuses Ashby and imported 133 vacancies; its exact-run technical audit matched every official posting ID, while access/scope reviews remain pending. Vercel reuses Greenhouse and imported 83 vacancies; native official posting IDs matched the exact imported run, while scope/access/display reviews remain pending. Mistral AI reuses Ashby and imported 208 vacancies from the current `mistral.ai` board; the official-linked hosted page exposes no visible posting IDs, so independent technical coverage remains partial. Cohere imported 130 jobs from its current Ashby board after explicit application-owner authorization for local import/display. Its employer access/display review remains pending and independent technical coverage partial. Explicitly blocked plans continue to gate candidate publication after extraction and before atomic storage. Ashby preserves displayed compensation and geographic tiers. Hugging Face adds public Workable widget enumeration and its advertised Markdown official inventory: five specific vacancies and matching features imported, Wild Card excluded, and all five native IDs reconciled to the exact successful run. Scope/access/display reviews remain pending. Perplexity reuses Ashby and imported 130 vacancies with 109 advertised compensation sections and matching features. Employer-site HTTP 403 challenges and hosted HTML without visible posting links prevent independent attribution/inventory reconciliation; access/scope/display review remains pending. Anysphere (Cursor) adds the employer-embedded public Ashby cursor board with 132 discovered postings. Its current terms restrict extraction, so the explicit access/display plan blocks candidate publication; no jobs or features were published. Native career title slugs have not been reconciled to Ashby UUIDs. Retrieval alone does not approve full-description display, scheduling, closure or worldwide employer completeness. Restart running API/worker processes after registry changes. See [AUDITING.md](AUDITING.md).

## Implementation and verification

- [Apple](../backend/src/infrastructure/adapters/apple.ts), [Amazon](../backend/src/infrastructure/adapters/amazon.ts), [Eightfold](../backend/src/infrastructure/adapters/eightfold.ts), [access gate](../backend/src/infrastructure/adapters/restricted.ts), [factory](../backend/src/infrastructure/adapters/factory.ts).
- [Native behavior tests](../backend/src/infrastructure/adapters/native.test.ts), [transport tests](../backend/src/infrastructure/http.test.ts), [PostgreSQL batch/rollback tests](../backend/src/infrastructure/storage/postgres.test.ts).
- [Sources](../backend/config/sources.json), [pending audit plans](../backend/config/source-audits.json). Live evidence and remaining limits belong in [SOURCE_CHECKS.md](SOURCE_CHECKS.md).
- [Durable priority report](../backend/config/integration-evidence/wave-c.json) records configuration hashes, actual run state, stored counts, validated examples and ignored diagnostic artifact hashes. Diagnostic samples are separate from exact successful-run database snapshots and never establish a complete Apple/Amazon import.
