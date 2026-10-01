# Resume analysis, documents and matching: testing guide

**Status:** Initial complete flow implemented, recorded 1 October 2026, Europe/Amsterdam. Text review, local documents, job features and explained matching are covered below. Production hosting/load and held-out calibration remain pending.

## Run and inspect

For weighted matching, use a synthetic profile with a dated role describing Redis, C++ and a led cross-functional initiative. Review it, open a job description, and inspect the green/yellow/purple/red legend and keyword tooltips. Redis → cloud → AWS must stay weak/yellow and retain a required gap; unrelated skills must remain red. Open the requirement explanation to inspect paths and independent industry/leadership thresholds. Toggle highlighting off to restore employer HTML. Edit or clear the resume and verify that prior highlights disappear until the new profile is reviewed. Check keyboard navigation, wrapped legend/path text and small screens. Use synthetic data only. [SKILL_RELATIONS](SKILL_RELATIONS.md) owns the versioned policy and automated cases.

Run the app using the existing [local setup](../README.md), then open the **Resume** navigation item or `http://127.0.0.1:5173/?view=resume`. Both demo and PostgreSQL modes support analysis; it does not read or write candidate records in either mode. Use synthetic examples before private resumes.

Choose an example, click **Analyze text**, and inspect the line-numbered reading preview, skill evidence, competencies, current location and employment records. The selector loads [the public synthetic corpus](../frontend/public/resume-evaluation.json): ten fictional resumes and three annotated job descriptions used by regression/review checks. They are never imported as real vacancies. Automated evaluation fixes the analysis date to 1 October 2026; the browser uses the server's current date.

## Manual checkpoints

| Checkpoint               | Action                                                                  | Expected result                                                                                         |
| ------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Overlaps                 | Analyze **Overlapping engineering roles**                               | Four professional years, not five; Meta recognized, Northstar Labs remains an ordinary unknown employer |
| Date correction          | Change the second role's end to **Dec 2024**                            | Five professional years after the automatic update; original preview/evidence remains unchanged         |
| Skill review             | Add **Kotlin**, confirm **Docker**, then remove Docker                  | Added/confirmed claims are labeled user confirmed; removal changes the count                            |
| Alias review             | Add **Postgres** to the first example                                   | Confirms the existing PostgreSQL concept without creating a duplicate                                   |
| Competency review        | Inspect Team leadership evidence; remove it or add a manual competency  | Supporting statement remains available; manual additions have confirmation provenance                   |
| Location                 | Change Amsterdam to **Berlin, Germany**                                 | Value is user confirmed; employment locations never establish home location                             |
| Learning/negative claims | Analyze **Learning and negative claims**                                | Python is learning; Java is a negative claim; JavaScript is distinct; Cambridge is uncertain            |
| Coarse dates             | Analyze **Year-only dates**                                             | Professional duration is a range (1y 2m–3y 0m), with a warning                                          |
| Internship               | Analyze **Internship and education separation**                         | Three internship months; no professional tenure from the degree or project                              |
| Missing/reversed dates   | Analyze **Missing and reversed dates**                                  | Duration shows unknown, two roles require date review; unknown does not mean zero experience            |
| Promotions               | Analyze **Promotions without double-counting**                          | Four professional years across overlapping Apple role entries                                           |
| Manual role              | Click **Add a role**; fill employer/title/dates and function            | Counts update from valid dates; missing values stay visible and uncertain                               |
| Remove role              | Remove an extracted or manually added role                              | It disappears from the reviewed profile and duration totals                                             |
| Clear/cancel             | Clear while analysis or correction is running                           | Input, results, corrections and pending requests are cleared; a late response must not restore them     |
| Navigation/reload        | Visit Jobs then Resume, then reload                                     | Review survives SPA navigation in this tab; a full reload starts empty                                  |
| Unsupported input        | Submit whitespace, very long lines or malformed corrections through API | A bounded, generic error is returned; no resume body is logged/cached                                   |

The shared vocabulary has **215 concepts: 206 skills/practices and nine competencies**, with 16 reviewed activity rules. Unknown terms can be added manually. This is a reproducible regression set, not a held-out performance benchmark or complete parser. Evidence samples are capped at five per signal. Skill-specific tenure remains unknown; optional reviewed same-employer/function context is explained separately and cannot change fit bands or override gaps.

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
