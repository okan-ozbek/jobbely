# Decision: resume-first glass interface

**Status:** Implemented, 4 October 2026, Europe/Amsterdam. Supersedes the 30 September editorial direction.

## Direction and rationale

The home page centers on one resume composer: paste text or attach a PDF/DOCX, explicitly request analysis, review the profile, then request job matches. A soft lavender/blue gradient, translucent surfaces, rounded corners and restrained typography provide the requested Apple/Meta-inspired direction. Decorative lighting uses CSS rather than remote assets or continuous animation.

Companies is the single header navigation action; the wordmark returns to the resume through SPA navigation. Existing public job search and detail routes remain available through company cards, recommendations and explicit `view=jobs` URLs. Profile state remains in tab memory across these views.

## Tokens and typography

Central tokens in [styles.css](../frontend/src/styles.css) use pale grey `#f5f6fb`, dark ink `#232538`, muted text `#62677c` and purple `#514abe` for small interactive text. DM Sans is locally hosted with system sans-serif fallbacks; display and body text share the same family. Directory logos use flat brand colors on transparent wrappers; the home logo row retains brand colors at 65% opacity. See [LOGOS](LOGOS.md) for sources and the Radix text fallback.

Glass surfaces use white gradients, fine white borders, subtle shadows and backdrop blur. Solid pale backgrounds remain readable without blur support. Shared searchable glass listboxes replace native select popups, retaining labels, keyboard navigation and visible focus. Catalog search keeps its original transparent background on focus and uses the search icon color as its focus cue without an added outline.

Primary actions, secondary review buttons and glass dropdown triggers share the `--control-height` token (42px). Primary buttons use horizontal padding only, including the mobile composer, so Review my resume, Find matching jobs and the company application action share the same height. Longer wrapping labels may grow to stay readable.

## Interaction invariants

- The initial home page contains one single-line-height, resizable composer, concise privacy/format guidance and a transparent company-logo row with softer brand colors. A selected file replaces the raw text input and attachment action. Corrections, compact combined skill/competency chips, degrees, skill years, roles and experience live behind an animated profile-review disclosure; raw reading and evidence previews are omitted. Matching uses a compact function dropdown and action row, stacked on mobile. Find matching jobs confirms the current profile; pending analysis disables it, and edits invalidate prior confirmation/results.
- Files continue through the existing isolated local worker. Analysis remains explicit and transient; no resume storage, automatic upload or privacy boundary change is introduced.
- Company cards show logo, name, a small named status icon, stored active listing count, internal jobs and original careers links through the logo/top arrow. Coverage explanations and check freshness appear on hover, focus or tap in a viewport-clamped context window. The redundant bottom careers button is omitted. Counts are catalog counts, not freshly verified recommendation counts.
- Desktop grids have four columns, three through 900px and two through 650px; below 360px they use one. Logo/arrow hover animations give brief feedback and respect reduced motion.
- The directory has Big tech and Quant & banking sections, with one search across both. This is an editorial presentation grouping, independent of source coverage and matching. Company names and adjacent status controls share a centered row. Recommendation cards have 32px between them, with no additional card margins.
- Full coverage is reserved for the existing healthy API state. Stale sources show Partial coverage plus Refresh overdue; failed sources show Refresh failed. Unconnected companies remain visibly Not connected, and synthetic sources retain sample labels.
- Closed, demo, empty, loading and error states remain explicit. Matching empty states distinguish jobs awaiting requirement analysis from a lack of freshly checked listings.
- Content-shaped glass skeletons indicate pending jobs, directory, detail, resume/file reading and matching. They shimmer only while loading, contain no fake content, and remain static under reduced motion. Changed filters replace old results immediately; pagination keeps the existing results and adds placeholders below.
- Native labels, keyboard focus, skip navigation, responsive controls and reduced-motion support remain. Status never depends on color alone. Page transitions, disclosure height/opacity, result entrance and smooth scrolling provide brief feedback; reduced motion removes animation and smooth scrolling. Skeleton shimmer runs only during pending work.

## Implementation and verification

Profile review places location and employment in one desktop column, alongside a combined education/skills panel. On narrow screens the columns stack. Each skill exposes duration and role origins on hover or keyboard focus; clicking opens a native modal editor with focus containment, Escape dismissal and editable years. Estimated role usage is labeled separately from resume claims and reviewed overrides. The redundant Experience by function panel is omitted; matching still uses reviewed role functions.

[App](../frontend/src/App.tsx), [resume composer](../frontend/src/features/resume/ResumeWorkbench.tsx), [matching UI](../frontend/src/features/resume/ResumeMatches.tsx), [shared styles](../frontend/src/styles.css), [resume styles](../frontend/src/features/resume/resume.css), [browser metadata](../frontend/index.html).

Run root formatting/lint, frontend types/tests/build and browser checks for home, companies, filtering, profile review, matching and job navigation. Verify desktop four-column layout and narrow-screen overflow; viewport emulation limitations must be reported rather than assumed away. Matching/source policies remain in [MATCHING](MATCHING.md) and [SOURCES](SOURCES.md). These interaction updates were added on 5 October 2026.
