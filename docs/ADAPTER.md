# Decision: provider adapters

**Status:** Implemented, 30 September 2026.

## Decision and rationale

Use one adapter per ATS provider, configured with an employer board identifier and, for enterprise boards, an explicit endpoint. Greenhouse, Ashby, Lever, Workday and iCIMS implement `SourceAdapter.extract(source)` and return `Extraction`: canonical postings, raw responses, exclusion count and explicit traversal completeness. Provider schemas and pagination stay inside infrastructure. The shared factory supplies the same implementations to bootstrap and auditing. LinkedIn has a fail-closed access gate pending an authorized feed.

The Adapter pattern isolates upstream differences. Bootstrap selects the provider implementation by `source.provider`; this is the extraction Strategy. Classification and lifecycle policies operate on canonical records and do not inspect ATS payloads. Composition avoids a base scraper with provider-specific hooks.

## Current provider behavior

| Provider   | Enumeration and translation                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Greenhouse | Requests full content, compares item count with `meta.total`, excludes prospect entries with null internal job IDs and generic talent-pool titles                        |
| Ashby      | Requires API version `1`, filters `isListed`, retains department/team and secondary locations; nullable workplace fields remain unknown                                  |
| Lever      | Traverses pages of 100 up to 100 pages, rejects repeated IDs, finishes only on a short page; assembles description, list sections, closing text and salary description   |
| Workday    | Exhausts CXS search and native category partitions, handles the 2,000-result cap and later-page zero-total sentinel, hydrates all descriptions and retains immutable IDs |
| iCIMS/Jibe | Traverses `/api/jobs` pages against explicit totals, retains full descriptions and native categories, applies explicit employer membership/URL host configuration        |

An adapter validates every received item with Zod before publishing a result. Missing required fields fail the run. Optional information can remain unknown; a missing remote flag does not imply on-site work. Employment labels are currently source strings, with `unknown` for absence. Ashby falls back to its job URL when the feed omits an ID.

## Invariants and extension procedure

Preserve source IDs, original department labels, locations, advertised dates where mapped, URLs and full descriptions. `enumerationComplete` proves traversal of this board, not complete employer scope. Adapters neither classify functions nor close jobs. Generic non-vacancy exclusions are explicit and counted.

For an existing provider, add a candidate entry to the registry and audit it. For a new provider, extend provider/config validation, implement the port, register it in bootstrap and the audit CLI, and add traversal/malformed-payload fixtures. Change the HTTP allowlist only when the new destination is required. A future regional Lever implementation needs a configured regional host; the current adapter uses the global endpoint.

## Implementation and verification

- [Port](../backend/src/ports/ingestion.ts), [models](../backend/src/domain/model.ts), [composition root](../backend/src/bootstrap.ts).
- [Adapters and schemas](../backend/src/infrastructure/adapters/), [adapter behavior tests](../backend/src/infrastructure/adapters/adapters.test.ts).
- [Source onboarding](SOURCES.md), [transport](HTTP.md), [live evidence](SOURCE_CHECKS.md).

[Adyen](ADYEN.md) reuses the existing Greenhouse adapter for its public `adyen` board. The full-content aggregate supplies every description without application/detail requests; candidate configuration and independent visible-board pagination review remain separate from successful collection.

[ASML](ASML.md) uses the existing explicit failure adapter until permitted full-description display and a complete compatible source are established. Its native provider/endpoint identify a candidate gate, not a working collector or a verified Workday board.

Detailed enterprise invariants and source assignments live in [WAVE_B.md](WAVE_B.md). Other custom boards and scraping remain planned extensions. No universal scraper, browser extraction adapter or MCP dependency is implemented.

Wave C's first batch adds Apple structured public HTML, Netflix Eightfold JSON and native Amazon JSON adapters, plus explicit Meta/Google access gates. See [WAVE_C.md](WAVE_C.md) for identity, traversal and completeness rules. Apple's parser decodes literal JSON without executing upstream scripts; native adapters preserve the same extraction port and classification boundary.

[Atlassian](ATLASSIAN.md) adds a native employer aggregate as the first 500-company backlog expansion. Its complete array is rechecked for drift; identical validated duplicates collapse, while conflicting identities, foreign links and missing readable job descriptions fail extraction. This payload is separate from iCIMS/Jibe search. Configuration remains candidate and unscheduled.

[Shopify](SHOPIFY.md) adds public HTML listing/detail hydration as the second backlog expansion. It decodes selected public fields from literal JSON without executing scripts, enumerates the full embedded posting array, hydrates every description and rechecks inventory metadata. Ashby-shaped identifiers alone do not establish compatibility with the generic Ashby feed. Candidate/scheduling and independent coverage gates remain intact.

[HubSpot](HUBSPOT.md) adds an explicit unavailable-source gate. Its observed public careers GraphQL service failed listing/detail discovery; the gate makes no network calls and cannot publish an empty successful inventory. It remains candidate and unscheduled until a usable source and access conditions are established.

[ServiceNow](SERVICENOW.md) introduces the public SmartRecruiters adapter: explicit PUBLIC-only pagination, immutable numeric posting IDs and UUIDs, complete advertisement/detail hydration, employer/link validation and a full inventory recheck. Empty or absent optional labels remain unknown. Every advertised textual section is retained; unsupported sections or malformed structured compensation fail rather than silently disappearing. Source activation remains separate.
