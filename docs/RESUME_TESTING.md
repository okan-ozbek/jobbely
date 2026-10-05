# Resume analysis, documents and matching: testing guide

**Status:** Initial complete flow implemented, recorded 1 October 2026, Europe/Amsterdam. Text review, local documents, job features and explained matching are covered below. Production hosting/load and held-out calibration remain pending.

## Run and inspect

For weighted matching, use a synthetic profile with a dated role describing Redis, C++ and a led cross-functional initiative. Review it, open a job description, and inspect the green/yellow/purple/red legend and keyword tooltips. Redis → cloud → AWS must stay weak/yellow and retain a required gap; unrelated skills must remain red. Hover, focus or tap highlighted terms to inspect match explanations and paths. Open a result explanation for independent industry/leadership thresholds. The employer HTML layout is always shown; the highlight toggle only changes annotations. Edit or clear the resume and verify that prior highlights disappear until the new profile is reviewed. Check keyboard navigation, wrapped legend/path text and small screens. Use synthetic data only. [SKILL_RELATIONS](SKILL_RELATIONS.md) owns the versioned policy and automated cases.

Run the app using the existing [local setup](../README.md), then open the resume home page or `http://127.0.0.1:5173/?view=resume`. Both demo and PostgreSQL modes support analysis; it does not read or write candidate records in either mode. Use synthetic examples before private resumes.

Paste an example, click **Review my resume**, then inspect combined skill/competency chips, current location and editable employment records. File attachments replace the paste input until removed; raw reading and evidence previews are omitted. Use [the public synthetic corpus](../frontend/public/resume-evaluation.json): ten fictional resumes and three annotated job descriptions used by regression/review checks. They are never imported as real vacancies. Automated evaluation fixes the analysis date to 1 October 2026; the browser uses the server's current date.

## Manual checkpoints

For the 5 October [qualification changes](QUALIFICATIONS.md), use a fictional profile with `BS in Computer Science 2015` and `8 years of experience with Java`. Confirm the education and Java years, then compare a job requiring `BS (or higher)` and `7+ years` in Java/Scala/C++. Degree/year aliases should be colored with their explanations. An unfinished Master must not meet a completed Master requirement; unknown related subjects/alternative skill years require review. Responsibility skills should appear as role relevance, adding at most five points without removing mandatory gaps. Removing/editing a degree or years invalidates review and results. Open a recommendation and return using **Back to resume**; checked review and result cards should remain.

Check the searchable glass dropdown with typing, arrows, Enter and Escape, country/city dependent facets, the single-line-height composer, nonselectable review labels, four-column desktop company cards, mobile overflow and status context via hover/focus/tap. No real candidate data should enter fixtures or logs.

Verification on 5 October 2026: `pnpm check` passed formatting, dependency boundaries, 60 logo paths, zero-warning lint, strict types, 513 backend and 29 frontend tests, contract generation and production builds. The default run skipped nine PostgreSQL cases; all nine passed separately against the isolated test database. Root lint was rerun after generated contracts. Public feature backfill inspected and updated 13,191 stored listings to the current extraction version; this is dated local catalog evidence, not employer coverage. Browser checks used only a fictional profile: the annotated Databricks role showed a completed Bachelor and eight reviewed Java years meeting the BS/7+ year requirements, and highlighted its responsibility skills. Resume-origin back navigation preserved checked review and 20 results. Desktop four-column and 390px mobile two-column layouts, degree/country listbox search/keyboard dismissal, and clamped context windows were inspected. Viewport emulation is not a physical-device or screen-reader audit; calibration remains pending.

| Checkpoint               | Action                                                                  | Expected result                                                                                            |
| ------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Overlaps                 | Analyze **Overlapping engineering roles**                               | Four professional years, not five; Meta recognized, Northstar Labs remains an ordinary unknown employer    |
| Date correction          | Change the second role's end to **Dec 2024**                            | Five professional years after the automatic update; original transient evidence metadata remains unchanged |
| Skill review             | Add **Kotlin**, then remove **Docker** from Skills                      | New keyword chips appear; removal changes the count and invalidates old matches                            |
| Alias review             | Add **Postgres** to the first example                                   | Confirms the existing PostgreSQL concept without creating a duplicate                                      |
| Competency review        | Find **Team leadership** in Skills and remove it                        | Inferred activities remain marked; removing a competency uses the same chip control                        |
| Location                 | Change Amsterdam to **Berlin, Germany**                                 | Value is user confirmed; employment locations never establish home location                                |
| Learning/negative claims | Analyze **Learning and negative claims**                                | Python is learning; Java is a negative claim; JavaScript is distinct; Cambridge is uncertain               |
| Coarse dates             | Analyze **Year-only dates**                                             | Professional duration is a range (1y 2m–3y 0m), with a warning                                             |
| Internship               | Analyze **Internship and education separation**                         | Three internship months; no professional tenure from the degree or project                                 |
| Missing/reversed dates   | Analyze **Missing and reversed dates**                                  | Duration shows unknown, two roles require date review; unknown does not mean zero experience               |
| Promotions               | Analyze **Promotions without double-counting**                          | Four professional years across overlapping Apple role entries                                              |
| Manual role              | Click **Add a role**; fill employer/title/dates and function            | Counts update from valid dates; missing values stay visible and uncertain                                  |
| Remove role              | Remove an extracted or manually added role                              | It disappears from the reviewed profile and duration totals                                                |
| Clear/cancel             | Clear while analysis or correction is running                           | Input, results, corrections and pending requests are cleared; a late response must not restore them        |
| Navigation/reload        | Visit Jobs then Resume, then reload                                     | Review survives SPA navigation in this tab; a full reload starts empty                                     |
| Unsupported input        | Submit whitespace, very long lines or malformed corrections through API | A bounded, generic error is returned; no resume body is logged/cached                                      |

The shared vocabulary has **239 concepts: 230 skills/practices and nine competencies**, with 21 reviewed activity rules. Unknown terms can be added manually. This is a reproducible regression set, not a held-out performance benchmark or complete parser. Evidence samples are capped at five per signal. Skill-specific tenure remains unknown; optional reviewed same-employer/function context is explained separately and cannot change fit bands or override gaps.

[Employment header regression tests](../backend/src/domain/resume/employment.test.ts) add a fictional six-role timeline with concurrent freelance/founder work, inline dates, a company name containing “Engineer” and page-continuation-style text. All six engineering roles must be detected, overlaps unioned, and responsibility prose rejected as headers. Tests cover separators, SWE/SDE titles, multiline evidence, missing-date preservation and incomplete-extraction warnings. The PDF adapter suite separately verifies right-aligned dates remain beside company/title text across pages. These fixtures contain no real candidate content.

## API and automated checks

`POST /api/v1/resume-analysis` accepts JSON with `text`, optional fixed `analysisDate`, and optional corrections. It returns evidence rather than a persisted profile ID. Corrections accompany the original text, so they replay without modifying extraction evidence. See [API](API.md).

```powershell
pnpm --filter @jobbely/backend exec vitest run src/domain/resume/evaluation.test.ts src/api/resume.test.ts
pnpm check
```

Behavior tests check corpus expectations, date precision/overlap, alias collisions, corrections, provenance, limits and evidence. API tests check schemas, no-store/origin/rate limits and unchanged candidate-free repository state. Matching requires the additive JobFeature migration and backfill. PostgreSQL tests require a separate `jobbely_test_*` database; skipped tests are not database verification.

Browser UI checks remain manual. Frontend document and session tests are automated; the isolation boundary is documented in [RESUME_PRIVACY](RESUME_PRIVACY.md).

## Complete-flow checkpoints

1. Apply migrations/backfill in PostgreSQL mode. Analyze a fictional engineering profile, correct a skill/date/location, confirm review and request recommendations. Expand explanations and open the job's original description/requirements. Verify required/preferred/contextual evidence, alternative groups, unknown specialist statements, experience bounds and freshness/coverage.
2. Edit the profile or preferences after matching. Results and review confirmation clear immediately; obsolete cursors return 409. Load another page and verify stable ordering without duplicates. Close/demo/stale/failed/incomplete/quarantined/missing cases are synthetic automated tests, not real source mutations.
3. Read equivalent synthetic PDF/DOCX files. Inspect reading-order metadata before Analyze, then compare text, detected claims and duration. Test a two-column PDF, DOCX tables/headers, broken words, damaged/image-only/encrypted PDFs and unsafe archives. Cancel while loading, Clear and reload; late work cannot restore cleared state.
4. Toggle employer context. Only reviewed direct experience in the same target employer/function can add 3 points, separately explained. Required gaps and fit bands remain unchanged; unknown employers have no penalty. Evaluate each supported function separately.
5. Verify the production preview or deployed host supplies strict parser CSP on HEAD/GET. Without it, file reading must refuse before accessing private bytes. Inspect mobile reading/review/explanation layout and keyboard controls. Confirm private fields never enter storage, URLs, fixtures, logs or caches.

```powershell
pnpm features:backfill
pnpm --filter @jobbely/frontend test
pnpm --filter @jobbely/backend exec vitest run src/domain/matching src/application/resume/match-jobs.test.ts src/api/matching.test.ts
pnpm check
```

The matching suite replays the original annotated engineering/data job descriptions and independently labeled cases for all five functions. A 25,000-feature synthetic scan checks bounded ranking responsiveness. PostgreSQL tests cover idempotence, concurrent writers, changed content and ingestion/projection races. These establish regression behavior, not held-out ranking quality, deployed isolation or production p95 under concurrent load. The current browser parser has no hard 512 MiB OS memory ceiling.

## Implementation references

- [Text/section extraction](../backend/src/domain/resume/document.ts), [employment/location](../backend/src/domain/resume/employment.ts), [skills/competencies](../backend/src/domain/resume/vocabulary.ts), [duration intervals](../backend/src/domain/resume/experience.ts).
- [Analysis service](../backend/src/application/resume/analyze-resume.ts), [route](../backend/src/api/resume-routes.ts), [schemas](../backend/src/api/resume-schemas.ts), [evaluation](../backend/src/domain/resume/evaluation.test.ts), [API tests](../backend/src/api/resume.test.ts).
- [Review UI](../frontend/src/features/resume/ResumeWorkbench.tsx), [transient/cancellable state](../frontend/src/features/resume/useResumeAnalysis.ts), [employment editor](../frontend/src/features/resume/EmploymentReview.tsx), [signal editor](../frontend/src/features/resume/SignalReview.tsx).

The implemented engineering clause and scoped-review policy is documented in [SEMANTICS.md](SEMANTICS.md). Test C++ → Clang/LLVM questions, usage versus development, confirmation/denial/unsure, five-question bounds and updated-profile review before reranking. The new synthetic corpus is regression evidence; independent held-out precision/recall remains pending.

## Engineering semantic increment — 2 October 2026

Root `pnpm check` passed formatting, boundaries, logos, zero-warning lint, both strict type checks, contracts and production builds. Its test run passed 400 backend tests and 22 frontend tests, skipping nine PostgreSQL tests. A separate run with the dedicated `TEST_DATABASE_URL` passed all **409 backend tests**, including the nine PostgreSQL cases. The final feature backfill inspected/updated **13,162 public postings** under `requirements-10:concepts-1:clauses-1`.

Synthetic cases cover 176 clause contrasts, 30 profile/job comparisons, repeated work/list evidence, scoped denials/confirmations/uncertainty, alias containment, footer policy exclusion and compound versus alternative tenure. The dense 25,000-job scan uses 40 requirements and 200 claims; it is a regression check, not a production latency or independent quality claim.

Manual browser checks used a fictional profile and an existing public compiler posting. LLVM was purple with a zero-credit question from C++; confirming usage cleared the old comparison and required profile review before a green highlight appeared. Removing the claim removed its scoped answer and restored the question. Denying usage produced a red highlight with no repeated question. Abstract failover, latency and cross-team activities appeared in the profile; highlighting could be disabled to restore the original description. At a 390 × 844 viewport, the legend and answer controls wrapped without horizontal overflow; keyboard focus remained visible and no browser errors were observed. The temporary viewport was reset after testing.

A local API smoke check analyzed a synthetic profile and ranked the current public eligible set: 3,163 jobs evaluated, zero unenriched, 20 results returned, about 1.8 seconds including analysis/network on this workstation. This dated single-request observation is not a concurrent-load or production latency guarantee.

## Structured matching stages 1-3, 2 October 2026

[STRUCTURED_MATCHING](STRUCTURED_MATCHING.md) records the new structure and evidence contract. Final root `pnpm check` with the dedicated PostgreSQL test environment passed all 425 backend tests (including nine database tests), 23 frontend tests, formatting, boundaries, assets, zero-warning lint, strict types, regenerated contracts and both production builds. Fifteen new structural regressions cover heading recovery, mixed preferences, unknown OR alternatives, independent thresholds, exact spans, wrapped bullets, reviewed project association, scoped AWS services and assertion contrasts. API/allowlist tests also check forged metadata, absent role references and evidence-edit cursor invalidation.

The final requirements-13:concepts-2:clauses-2:job-document-1 public backfill rebuilt 13,162 jobs and repeated idempotently. A local engineering matching request evaluated 3,163 eligible jobs with zero unenriched jobs and 20 results in about 2.4 seconds. Browser checks used synthetic candidates and verified full/partial/missing colors, uncolored application text, original-description access, source evidence, review gating, reload clearing and all three groups at 1280px and 375px without horizontal overflow. These are regression and local smoke results; independent accuracy/calibration and production concurrency remain pending.

## Compact profile and interaction verification, 5 October 2026

Final root `pnpm check` passed formatting, dependency boundaries, logo assets, zero-warning lint, strict types, regenerated contracts and both production builds. Tests passed **465 backend cases and 29 frontend cases**; nine PostgreSQL cases were skipped because `TEST_DATABASE_URL` was not set. No persistence/schema changes were made in this UI increment.

New synthetic regressions cover title schedule cleanup, direct/client defaults, dominant-function inference with unsupported-function fallback, default acceptance of listed positive self-reports without overriding development/denied/learning/ambiguous limits, and original-HTML offset alignment across emphasis, repeated terms and normalized heading colons. Other text mismatches leave the original unhighlighted text readable.

Development-browser checks verified one attached PDF replaces text/attachment controls, removal restores paste/attachment, skills and competencies share removable chips, removal invalidates old matches, normal/freelance relationship defaults, clean titles, inferred Engineering selection, matching and scrolling, animated profile/result disclosures, Companies navigation and retained private state. Original employer paragraphs/lists/links remain available without a layout toggle or requirements sidebar. Green and yellow terms expose relevant context with keyboard activation/Escape; clicking/tapping pins the popup until dismissal, and yellow storage-system overlap displays its related Microservices evidence. Desktop five-column company cards and the 390 × 844 context window fit without horizontal overflow; temporary viewport settings were reset. Browser screenshots and fixtures use fictional candidate text only. Real-resume verification was transient and produced structural diagnostics, with no candidate fixture or saved extraction.

The live development smoke request evaluated 188 currently fresh Engineering jobs with zero unenriched items. This is dated local availability evidence, not a ranking calibration or production load result. Production browser/CSP verification and independent matching-quality evaluation remain separate gates.

## Matching controls, 5 October 2026

Analyze a synthetic profile and verify that matching exposes only a function dropdown and Find matching jobs button. The button confirms the current profile and starts matching without a checkbox. During analysis/recalculation or a matching request, it is disabled. Changing the profile or function clears recommendations and description-comparison confirmation; clicking the button confirms the updated profile. Check pagination and comparison navigation after matching, and verify that the controls stack without overflow on mobile.

## Combined skills and employment review, 5 October 2026

Use fictional employers and skill evidence only. Analyze overlapping dated roles that explicitly use TypeScript and AWS, plus a standalone Java skills list. Verify the TypeScript context counts overlaps once, AWS uses only its linked role and Java has no automatic years. Employment/date/type edits recalculate estimates; removed skills and roles disappear from estimates. Inferred activities, learning, denied usage, projects and internships receive no estimated years. Coarse dates show a range and require a manually entered duration for matching.

Open profile review on desktop and mobile. Verify education/skills share a panel beside location/employment, secondary degree/role buttons match site controls, and Experience by function is absent. Focus/hover a skill to inspect duration and origins. Click/tap to edit, save a decimal year value or zero, and confirm the new reviewed value replaces the estimate. Check native modal Tab focus, Escape dismissal and focus return. Matching remains disabled during recalculation; date/skill edits invalidate old results. Check no horizontal overflow at 390px and restore temporary viewport overrides.

Verification for this increment: final root `pnpm check` passed formatting, boundaries, logo assets, zero-warning lint, strict types, regenerated contracts and both builds. All 522 backend and 33 frontend tests passed; nine PostgreSQL tests were skipped because `TEST_DATABASE_URL` was not set. No storage changes were made. Synthetic browser checks at 1285 × 1244 and 390 × 844 verified exact/overlapping role estimates, decimal and zero overrides, degree addition, date recalculation, invalidated matches, disabled duration editing during recalculation, keyboard context/native modal focus and Escape, shared 42px secondary controls, absence of the function panel and no horizontal overflow. The smoke matching request evaluated 188 eligible jobs. Temporary viewport overrides were reset and the test tab closed; saved screenshots contain fictional employers only.
