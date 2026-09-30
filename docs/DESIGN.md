# Decision: minimal editorial interface

**Status:** Implemented, 30 September 2026.

## Direction and rationale

Use [Pixelware](https://pixelware.nl/) as the visual reference: warm paper, near-black ink, a vivid red signal, Faculty Glyphic display typography, DM Sans body text, open space and fine dividing lines. Adapt the direction to a job-search utility: a short introduction, immediately available search, three visible filters, readable listing rows, a company directory and a full detail page.

The UI omits portfolio animations, decorative statistics, repeated promotional copy and redundant source notes. Company coverage, original department labels, timestamps, closed-vacancy state and the synthetic-preview notice remain because they help users assess a listing. `partial` coverage is presented as “Partial coverage”; provider audits remain an operator concern.

## Tokens and typography

| Token           | Value     | Purpose                                              |
| --------------- | --------- | ---------------------------------------------------- |
| `--paper`       | `#f4f2ee` | Main background                                      |
| `--surface`     | `#fcfbf8` | Search controls and detail panel                     |
| `--ink`         | `#121114` | Primary text                                         |
| `--muted`       | `#5c5860` | Secondary text                                       |
| `--border`      | `#d6d2d6` | Dividers and control outlines                        |
| `--signal`      | `#ff0000` | Large display text, active underline, primary action |
| `--signal-text` | `#b40000` | Small interactive text and focus indicators          |

Keep tokens centralized in [`styles.css`](../frontend/src/styles.css). Faculty Glyphic is used for the wordmark, display headings, job titles and company names at its available regular weight. DM Sans is used for controls, metadata and long descriptions. Avoid synthetic display-font weights.

Fonts are hosted in [`frontend/public/fonts`](../frontend/public/fonts/) with Latin/extended Latin WOFF2 files and their original OFL licenses. Only the common Latin subsets are preloaded. `font-display: swap` and system fallbacks keep content readable while loading. Production serves these files with the rest of the static build; rendering makes no Google Fonts requests. Their README records exact sources.

## Layout and interaction invariants

- Keep search and filters visible; filtering and job navigation continue to use shareable query parameters.
- Use a bounded content width, generous row spacing, restrained borders and a shared logo treatment. Logos retain their original colors on white.
- The company grid responds from four to three to two columns. Small screens stack the introduction and put job facts/application links before the description.
- Support long job titles, multi-location text and sanitized rich descriptions without horizontal page overflow.
- Use visible focus indicators, a skip link, native labeled inputs/selects and descriptive company action labels. Never rely on a colored status dot alone.
- Use vivid red for large type and black-text primary actions; use the darker red for small links and feedback. Muted text remains readable against paper/surface backgrounds.
- Hover states do not shift content. Reduced-motion preferences disable transitions. The design adds no continuous animation.
- Style loading, empty, error, demo and closed states consistently; their meaning must not be removed during visual cleanup.

## Implementation and verification

[`App.tsx`](../frontend/src/App.tsx) owns view markup; request state remains in the existing hooks. [`styles.css`](../frontend/src/styles.css) owns tokens, typography, component styles and breakpoints. [`index.html`](../frontend/index.html) preloads fonts and defines the matching browser theme/favicon. [`CompanyLogo`](../frontend/src/components/CompanyLogo.tsx) still owns failed-image behavior; see [LOGOS.md](LOGOS.md).

Run `pnpm format` and `pnpm check`. Verify desktop and narrow-screen listing/directory/detail views, search/filter/reset behavior, pagination, original employer links, empty/loading states, local font loading and page overflow. Browser checks are manual; the repository does not yet include an automated frontend suite. See [FRONTEND.md](FRONTEND.md) and [QUALITY.md](QUALITY.md).
