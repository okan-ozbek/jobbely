# Decision: independent React client

**Status:** Implemented for the first slice, 30 September 2026.

## Decision and rationale

Use React and Vite in `/frontend`, built independently from the backend. The public API is the only data boundary. Generated OpenAPI types keep consumers aligned while avoiding backend imports, Prisma entities and provider-specific objects in the browser.

The UI searches stored jobs, filters by company/function/workplace, opens full sanitized descriptions, links to employer applications and displays company coverage. All 60 configured employers appear in the directory, including companies that have no connected source.

`CompanyLogo` renders local assets from each company's API-provided `logoUrl` in the directory, job rows and details. Missing/failed images use a local N/A asset. Source records, maintenance and fallback rules live in [LOGOS.md](LOGOS.md).

The 4 October redesign defaults to a centered resume composer with a translucent glass interface, soft lavender/blue gradients and locally hosted DM Sans. Companies is the header navigation action; its directory uses five columns on wide screens. Existing catalog/detail routes remain accessible from company cards and matches. Visual tokens, responsive layouts and accessibility rules are recorded in [DESIGN.md](DESIGN.md).

## State and responsibilities

- `useLocationQuery` owns query-string state and browser history. Filters and selected job are shareable URL parameters; search typing replaces history entries while navigation pushes them.
- `useJobCatalog` owns debounced, abortable catalog requests and pagination. Request sequence checks prevent superseded responses from replacing current results. A stale cursor restarts the list.
- `useJobDetail` owns cancellable detail loading and ignores responses after cancellation.
- The typed API client owns HTTP calls and public error decoding. Rendering consumes canonical public records.

The catalog currently fetches companies/categories alongside each filter refresh rather than caching metadata separately. This is simple for the first slice but should be reduced as traffic grows.

## Invariants and deployment behavior

Synthetic mode is clearly labeled and never offers an active application link for a demo record. Closed stored jobs display closure status instead of an apply action. Unknown workplace/employment information stays unspecified. Original department labels and first/last observation times remain visible.

Job rows and pagination are disabled while their current query is refreshing. Sanitized HTML comes from the backend; no raw ATS body is rendered. Inputs and navigation have semantic labels/focus styles, and CSS includes mobile breakpoints.

Development proxies `/api` to the local backend. Production uses a same-origin reverse proxy by default, or `VITE_API_BASE_URL` for a separate public API origin. That variable is a build input; rebuilding is required when changing it. Serve the built static files and support SPA fallback. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Resume workbench

The [Resume feature](../frontend/src/features/resume/ResumeWorkbench.tsx) remains in tab memory across SPA navigation. Analysis debounces corrections by 350 ms and aborts replaced requests. Local PDF/DOCX workers supply editable text and ordered previews, with CSP preflight and cancellation. The reviewed allowlist drives matching; edits/preferences/pending analysis invalidate results, review confirmation and pagination. Full reload/Clear loses private state; storage and URL parameters contain no candidate fields. Job details display requirements beside the original description. See [RESUME_TESTING](RESUME_TESTING.md), [DOCUMENTS](DOCUMENTS.md) and [MATCHING](MATCHING.md).

## Implementation, limits and verification

[App](../frontend/src/App.tsx), [request/navigation hooks](../frontend/src/hooks/), [client](../frontend/src/api/client.ts), [Vite config](../frontend/vite.config.ts), [styles](../frontend/src/styles.css).

Document adapters and cancellation/isolation sessions now have automated frontend tests. Browser UI checks remain manual. General catalog queries and metadata caching remain separate follow-ups; rendering must not introduce provider logic.

Engineering semantic matching now distinguishes full (green), partial (yellow), suggested (purple, zero credit) and absent/denied (red) coverage. Scoped tool-usage/development answers stay transient and invalidate profile review and pagination. Matching accepts bounded semantic metadata, never resume excerpts. See [SEMANTICS.md](SEMANTICS.md) for the implemented registry, context guards, confirmation flow and limits.
