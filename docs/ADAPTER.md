# Decision: provider adapters

**Status:** Implemented, 30 September 2026.

## Decision and rationale

Use one adapter per ATS provider, configured with an employer board identifier. Greenhouse, Ashby and Lever implement `SourceAdapter.extract(source)` and return `Extraction`: canonical postings, raw responses, exclusion count and explicit traversal completeness. Provider schemas and pagination stay inside infrastructure.

The Adapter pattern isolates upstream differences. Bootstrap selects the provider implementation by `source.provider`; this is the extraction Strategy. Classification and lifecycle policies operate on canonical records and do not inspect ATS payloads. Composition avoids a base scraper with provider-specific hooks.

## Current provider behavior

| Provider   | Enumeration and translation                                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Greenhouse | Requests full content, compares item count with `meta.total`, excludes prospect entries with null internal job IDs and generic talent-pool titles                      |
| Ashby      | Requires API version `1`, filters `isListed`, retains department/team and secondary locations; nullable workplace fields remain unknown                                |
| Lever      | Traverses pages of 100 up to 100 pages, rejects repeated IDs, finishes only on a short page; assembles description, list sections, closing text and salary description |

An adapter validates every received item with Zod before publishing a result. Missing required fields fail the run. Optional information can remain unknown; a missing remote flag does not imply on-site work. Employment labels are currently source strings, with `unknown` for absence. Ashby falls back to its job URL when the feed omits an ID.

## Invariants and extension procedure

Preserve source IDs, original department labels, locations, advertised dates where mapped, URLs and full descriptions. `enumerationComplete` proves traversal of this board, not complete employer scope. Adapters neither classify functions nor close jobs. Generic non-vacancy exclusions are explicit and counted.

For an existing provider, add a candidate entry to the registry and audit it. For a new provider, extend provider/config validation, implement the port, register it in bootstrap and the audit CLI, and add traversal/malformed-payload fixtures. Change the HTTP allowlist only when the new destination is required. A future regional Lever implementation needs a configured regional host; the current adapter uses the global endpoint.

## Implementation and verification

- [Port](../backend/src/ports/ingestion.ts), [models](../backend/src/domain/model.ts), [composition root](../backend/src/bootstrap.ts).
- [Adapters and schemas](../backend/src/infrastructure/adapters/), [adapter behavior tests](../backend/src/infrastructure/adapters/adapters.test.ts).
- [Source onboarding](SOURCES.md), [transport](HTTP.md), [live evidence](SOURCE_CHECKS.md).

Custom enterprise boards and scraping are planned extensions. No universal scraper, browser extraction adapter or MCP dependency is implemented.
