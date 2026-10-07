# Decision: independent React client

**Status:** Implemented for the first slice, 30 September 2026.

## Decision and rationale

Use React and Vite in `/frontend`, built independently from the backend. The public API is the only data boundary. Generated OpenAPI types keep consumers aligned while avoiding backend imports, Prisma entities and provider-specific objects in the browser.

The UI searches stored jobs, filters by company/function/workplace, opens full sanitized descriptions, links to employer applications and displays company coverage. All 60 configured employers appear in the directory, including companies that have no connected source.

`CompanyLogo` renders local assets from each company's API-provided `logoUrl` in the directory, job rows and details. Missing/failed images use a local N/A asset. Source records, maintenance and fallback rules live in [LOGOS.md](LOGOS.md).

[CompanyDirectory](../frontend/src/components/CompanyDirectory.tsx) groups the 60 employers into Big tech (41), Quant (13, including banking), Gaming (2) and AI (4), with a shared company-name search that hides empty groups. Gaming contains Riot Games and Blizzard; AI contains OpenAI, Anthropic, Databricks and Palantir. Group membership is presentation-only and does not change registry identifiers, source coverage or matching. Directory SVGs retain flat brand colors on transparent wrappers; home marks retain brand colors at 65% opacity.

The 4 October redesign defaults to a centered resume composer with a translucent glass interface, soft lavender/blue gradients and locally hosted DM Sans. Companies is the header navigation action; its directory now uses four columns on wide screens. Existing catalog/detail routes remain accessible from company cards and matches. Visual tokens, responsive layouts and accessibility rules are recorded in [DESIGN.md](DESIGN.md).

The 5 October annotations add country/city catalog filters with dependent facet choices, keyboard-accessible [GlassSelect](../frontend/src/components/GlassSelect.tsx) popups and [CoverageStatus](../frontend/src/components/CoverageStatus.tsx) context windows. Catalog location parsing is conservative and independent of resume eligibility. Selectors are disabled while their query refreshes to prevent stale dependent options. Jobs opened from recommendations record `from=resume`; the back action restores mounted resume results and scrolls to them. Catalog-origin jobs return to jobs. Unknown workplace metadata reads “Work arrangement not listed”. Degree and explicit skill-year review follows [QUALIFICATIONS](QUALIFICATIONS.md).

## State and responsibilities

- `useLocationQuery` owns query-string state and browser history. Filters and selected job are shareable URL parameters; search typing replaces history entries while navigation pushes them.
- `useJobCatalog` owns debounced, abortable catalog requests and pagination. The settled query/retry identifies which results may render; changed filters immediately hide previous rows, before the request effect runs. Refreshes clear rows/count/cursor, including on failure, so another company's jobs cannot appear under the new filters. Request sequence checks prevent superseded responses from replacing current results. A stale cursor restarts the list.
- `useJobDetail` owns cancellable detail loading and ignores responses after cancellation. Both the displayed job and error are keyed to the selected ID, preventing a prior detail from flashing during navigation.
- The typed API client owns HTTP calls and public error decoding. Rendering consumes canonical public records.

[LoadingSkeleton](../frontend/src/components/LoadingSkeleton.tsx) supplies content-shaped placeholders for the job catalog, append pagination, initial company directory, job detail, requirement reading, profile comparison, local file reading, initial resume analysis, recalculated experience totals and matching. Existing catalog/recommendation rows remain visible only when appending to the same result set. Editable review controls stay mounted during recalculation. Skeletons contain no pretend employer/job data or interactive controls, announce a concise loading status and stop shimmering for reduced-motion preferences. Failure/empty states replace them when requests settle.

The catalog currently fetches companies/categories alongside each filter refresh rather than caching metadata separately. This is simple for the first slice but should be reduced as traffic grows.

## Invariants and deployment behavior

The [account dialog](../frontend/src/features/accounts/AccountMenu.tsx) keeps native email registration/login, confirmation codes and password reset in place; SSO opens separately so the original resume tab stays mounted. [EmailAccountForm](../frontend/src/features/accounts/EmailAccountForm.tsx) aborts replaced requests and retains credentials/codes only in component memory, cleared on mode change/unmount. Provider availability comes from the API; unavailable email sign-in is disabled and configured SSO providers are shown. Focus refreshes the server account. Logout or observed identity loss/change clears transient profile/comparison and remounts the document workbench. Native dialog focus/Escape behavior is retained. No private browser storage or Checkout is introduced; see [ACCOUNTS](ACCOUNTS.md) and [EMAIL_ACCOUNTS](EMAIL_ACCOUNTS.md).

Synthetic mode is clearly labeled and never offers an active application link for a demo record. Closed stored jobs display closure status instead of an apply action. Unknown workplace/employment information stays unspecified. Original department labels and first/last observation times remain visible.

Job rows and pagination are disabled while their current query is refreshing. Sanitized HTML comes from the backend; no raw ATS body is rendered. Inputs and navigation have semantic labels/focus styles, and CSS includes mobile breakpoints.

Development proxies `/api` to the local backend. Production uses a same-origin reverse proxy by default, or `VITE_API_BASE_URL` for a separate public API origin. That variable is a build input; rebuilding is required when changing it. Serve the built static files and support SPA fallback. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Resume workbench

The account dialog also offers permanent deletion with a `DELETE` confirmation and cancellation. Success clears the account and transient workbench, then shows a deletion receipt beside sign-in controls. Dismissal is blocked during account mutation, replaced reads are aborted, and focus refresh waits for the mutation to finish. A session older than ten minutes is asked to sign out and sign in again before deletion.

The [Resume feature](../frontend/src/features/resume/ResumeWorkbench.tsx) remains in tab memory across SPA navigation. Analysis debounces corrections by 350 ms and aborts replaced requests. Local PDF/DOCX workers extract bounded text with CSP preflight and cancellation. A selected file replaces the paste input and attachment control; remove it before selecting another. Raw reading previews are omitted. Skills and competencies share removable chips; location, roles and dates remain editable. The matching controls contain only a function dropdown and button. Clicking Find matching jobs confirms the current analysis for the matching allowlist and job-description comparisons; edits/function changes/pending analysis invalidate results, review confirmation and pagination. Full reload/Clear loses private state; storage and URL parameters contain no candidate fields. Job details preserve original sanitized employer markup and put comparison explanations on focusable highlighted terms. See [RESUME_TESTING](RESUME_TESTING.md), [DOCUMENTS](DOCUMENTS.md) and [MATCHING](MATCHING.md).

## Implementation, limits and verification

[App](../frontend/src/App.tsx), [request/navigation hooks](../frontend/src/hooks/), [client](../frontend/src/api/client.ts), [Vite config](../frontend/vite.config.ts), [styles](../frontend/src/styles.css).

Document adapters and cancellation/isolation sessions now have automated frontend tests. Browser UI checks remain manual. General catalog queries and metadata caching remain separate follow-ups; rendering must not introduce provider logic.

The 5 October simplification uses [animated disclosures](../frontend/src/components/Disclosure.tsx), brief page entrance animations and smooth scrolling to matching/results. Page motion preserves the mounted workbench and keeps controls available; rapid navigation cancels the preceding animation. All respect reduced-motion preferences. Auto function selection uses the largest supported unioned professional experience, then role counts; unknown/unsupported functions fall back to all supported functions, with an explicit override. Optional employer context is disabled in browser requests.

Engineering semantic matching now distinguishes full (green), partial (yellow), suggested (purple, zero credit) and absent/denied (red) coverage. Scoped tool-usage/development answers stay transient and invalidate profile review and pagination. Matching accepts bounded semantic metadata, never resume excerpts. See [SEMANTICS.md](SEMANTICS.md) for the implemented registry, context guards, confirmation flow and limits.

## Combined qualification review, 5 October 2026

The profile disclosure places location/employment beside education and skills, stacking at 800px. Skills retain separate edit/remove controls. Hover/focus shows duration context; click opens the native modal years/months editor. Degree and role additions use shared secondary buttons. The redundant function-duration display is removed, while domain matching still retains function tenure.

Analysis exposes optional `skillTenureEstimates` separately from explicit `skillTenure`. The [reviewed projection](../frontend/src/features/resume/skill-tenure.ts) submits exact direct estimates when Find matching jobs confirms the profile; coarse date ranges require edited years. Manual/explicit claims override estimates, including zero. Projection sends only skill ID/months, never estimate role origins or excerpts. Corrections replay and invalidate confirmation/results as before. See [QUALIFICATIONS](QUALIFICATIONS.md) for role-linkage and exclusion rules.

Match explanations use a bordered disclosure control with a larger chevron. Skill evidence is stably ordered by full, partial, suggested and absent coverage without mutating the API response. Reviewed job descriptions always show recognized highlights; the checkbox and interaction helper are omitted. Recommendation cards and the comparison header separate the review band, Fit on assessed criteria and Assessment coverage, with identified/assessed counts and expandable score guidance. They use the same MatchMetrics component and short gap/review counts, while a source-check disclosure retains exact availability and check-time details, including an explicit description-only label for ineligible listings.
