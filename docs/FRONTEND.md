# Decision: independent React client

**Status:** Implemented for the first slice, 30 September 2026.

## Decision and rationale

Use React and Vite in `/frontend`, built independently from the backend. The public API is the only data boundary. Generated OpenAPI types keep consumers aligned while avoiding backend imports, Prisma entities and provider-specific objects in the browser.

The UI searches stored jobs, filters by company/function/workplace, opens full sanitized descriptions, links to employer applications and displays company coverage. All 60 configured employers appear in the directory, including companies that have no connected source.

`CompanyLogo` renders local assets from each company's API-provided `logoUrl` in the directory, job rows and details. Missing/failed images use a local N/A asset. Source records, maintenance and fallback rules live in [LOGOS.md](LOGOS.md).

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

## Implementation, limits and verification

[App](../frontend/src/App.tsx), [request/navigation hooks](../frontend/src/hooks/), [client](../frontend/src/api/client.ts), [Vite config](../frontend/vite.config.ts), [styles](../frontend/src/styles.css).

Browser checks covered live search/filter/detail/pagination/coverage and a mobile detail viewport in the initial slice. There is no automated frontend/browser test suite yet. Larger UI work should extract feature components from `App`, add metadata caching where justified, and test user behavior without introducing provider logic into rendering.
