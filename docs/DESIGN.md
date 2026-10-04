# Decision: resume-first glass interface

**Status:** Implemented, 4 October 2026, Europe/Amsterdam. Supersedes the 30 September editorial direction.

## Direction and rationale

The home page centers on one resume composer: paste text or attach a PDF/DOCX, explicitly request analysis, review the profile, then request job matches. A soft lavender/blue gradient, translucent surfaces, rounded corners and restrained typography provide the requested Apple/Meta-inspired direction. Decorative lighting uses CSS rather than remote assets or continuous animation.

Companies is the single header navigation action; the wordmark returns to the resume through SPA navigation. Existing public job search and detail routes remain available through company cards, recommendations and explicit `view=jobs` URLs. Profile state remains in tab memory across these views.

## Tokens and typography

Central tokens in [styles.css](../frontend/src/styles.css) use pale grey `#f5f6fb`, dark ink `#232538`, muted text `#62677c` and purple `#514abe` for small interactive text. DM Sans is locally hosted with system sans-serif fallbacks; display and body text share the same family. Company logos retain original colors on white.

Glass surfaces use white gradients, fine white borders, subtle shadows and backdrop blur. Solid pale backgrounds remain readable without blur support. Content containers and native controls retain visible focus styles.

## Interaction invariants

- The initial home page contains one composer, concise privacy/format guidance and a small company-logo row. Analysis corrections, reading order, roles and experience live behind a profile-review disclosure. Matching still requires explicit review confirmation.
- Files continue through the existing isolated local worker. Analysis remains explicit and transient; no resume storage, automatic upload or privacy boundary change is introduced.
- Company cards show logo, name, coverage status, stored active listing count, check freshness, internal jobs and original careers links. Counts are catalog counts, not freshly verified recommendation counts.
- Desktop grids have five columns above 1150px, four through 1150px, three through 900px and two through 650px; very narrow screens use one. These breakpoints prevent compressed unreadable cards.
- Full coverage is reserved for the existing healthy API state. Stale sources show Partial coverage plus Refresh overdue; failed sources show Refresh failed. Unconnected companies remain visibly Not connected, and synthetic sources retain sample labels.
- Closed, demo, empty, loading and error states remain explicit. Matching empty states distinguish jobs awaiting requirement analysis from a lack of freshly checked listings.
- Native labels, keyboard focus, skip navigation, responsive controls and reduced-motion support remain. Status never depends on color alone. No continuous animation is added.

## Implementation and verification

[App](../frontend/src/App.tsx), [resume composer](../frontend/src/features/resume/ResumeWorkbench.tsx), [matching UI](../frontend/src/features/resume/ResumeMatches.tsx), [shared styles](../frontend/src/styles.css), [resume styles](../frontend/src/features/resume/resume.css), [browser metadata](../frontend/index.html).

Run root formatting/lint, frontend types/tests/build and browser checks for home, companies, filtering, profile review, matching and job navigation. Verify desktop five-column layout and narrow-screen overflow; viewport emulation limitations must be reported rather than assumed away. Matching/source policies remain in [MATCHING](MATCHING.md) and [SOURCES](SOURCES.md).
