# Resume increment 1: testing guide

**Status:** Pasted-text analysis implemented for steps 1–4. Recorded 1 October 2026, Europe/Amsterdam. PDF/DOCX, requirement enrichment, ranking and employer bonuses remain deferred.

## Run and inspect

Run the app using the existing [local setup](../README.md), then open the **Resume** navigation item or `http://127.0.0.1:5173/?view=resume`. Both demo and PostgreSQL modes support analysis; it does not read or write candidate records in either mode. Use synthetic examples before private resumes.

Choose an example, click **Analyze text**, and inspect the line-numbered reading preview, skill evidence, competencies, current location and employment records. The selector loads [the public synthetic corpus](../frontend/public/resume-evaluation.json): ten fictional resumes and three job descriptions reserved for future matching tests. They are never imported as real vacancies. Automated evaluation fixes the analysis date to 1 October 2026; the browser uses the server's current date.

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

The starter vocabulary has **51 skill concepts and four competency rules**. Unknown terms can be added manually. This is an initial reproducible evaluation set, not a held-out performance benchmark or complete resume parser. Evidence samples are capped at five excerpts per signal; there is no skill-specific tenure or employer weighting in this increment.

## API and automated checks

`POST /api/v1/resume-analysis` accepts JSON with `text`, optional fixed `analysisDate`, and optional corrections. It returns evidence rather than a persisted profile ID. Corrections accompany the original text, so they replay without modifying extraction evidence. See [API](API.md).

```powershell
pnpm --filter @jobbely/backend exec vitest run src/domain/resume/evaluation.test.ts src/api/resume.test.ts
pnpm check
```

Behavior tests check every corpus expectation, date precision/overlap, alias collisions, manual corrections, provenance, input limits and bounded evidence. API tests check schemas, no-store headers, origin/rate/format limits, absence of profile retrieval and unchanged repository state. No PostgreSQL schema changes are required; the broader suite's database tests still require a separate test database.

Browser verification covers sample analysis, corrections, skill addition/removal, clear/reload, ordinary Jobs navigation and a mobile viewport. Browser checks are currently manual rather than a committed automated frontend suite. Before file uploads, verify the isolation boundary in [RESUME_PRIVACY](RESUME_PRIVACY.md).

## Implementation references

- [Text/section extraction](../backend/src/domain/resume/document.ts), [employment/location](../backend/src/domain/resume/employment.ts), [skills/competencies](../backend/src/domain/resume/vocabulary.ts), [duration intervals](../backend/src/domain/resume/experience.ts).
- [Analysis service](../backend/src/application/resume/analyze-resume.ts), [route](../backend/src/api/resume-routes.ts), [schemas](../backend/src/api/resume-schemas.ts), [evaluation](../backend/src/domain/resume/evaluation.test.ts), [API tests](../backend/src/api/resume.test.ts).
- [Review UI](../frontend/src/features/resume/ResumeWorkbench.tsx), [transient/cancellable state](../frontend/src/features/resume/useResumeAnalysis.ts), [employment editor](../frontend/src/features/resume/EmploymentReview.tsx), [signal editor](../frontend/src/features/resume/SignalReview.tsx).
