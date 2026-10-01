# Decision: resume extraction and evidence

**Status:** Pasted-text starter implemented; PDF/DOCX and broader vocabularies remain proposed. Recorded 1 October 2026, Europe/Amsterdam. Product scope and delivery gates: [RESUME_PLAN.md](../RESUME_PLAN.md). Current checks: [RESUME_TESTING](RESUME_TESTING.md).

## Implemented first increment

The pure [text reader](../backend/src/domain/resume/document.ts) preserves line order and provides offsets into the returned CRLF-normalized text. Recognized English section headings control interpretation. [Analysis](../backend/src/application/resume/analyze-resume.ts) combines 51 skill concepts, four explicit competency rules, conservative employment headers and header-only location detection. Unknown fields remain editable; unsupported role formats need manual entry. No candidate data is persisted, no AI is called and no company bonus is applied.

[Experience](../backend/src/domain/resume/experience.ts) unions month intervals, clips ongoing roles to the fixed analysis month, returns bounds for year-only dates, excludes missing/reversed/future dates and separates internships/projects/education. Complete elapsed months are reported: the current month is not counted as a completed month. Exact day-level duration and FTE adjustment are not implemented. Function totals use reviewed role categories, not inferred tenure of individual skills.

[The UI](../frontend/src/features/resume/ResumeWorkbench.tsx) displays evidence and sends debounced manual signal/role/location corrections to the stateless API. Corrections preserve original excerpts and text, and update recognition/duration. Fields are not externally verified. Evidence samples are bounded to five excerpts per signal, retaining supporting evidence for the selected claim status.

The remaining sections describe the intended full architecture. Format adapters and an extraction port will be introduced when PDF/DOCX creates that actual boundary; the plain-text reader needs no interface or subprocess.

## Decision and rationale

Translate PDF, DOCX and pasted text through format adapters into one evidence-bearing document. Interpret that document with deterministic section, skill, employer and date policies. Keep an editable candidate profile separate from the initial extraction. This reuses the existing [layer rules](ARCHITECTURE.md) and preserves the project's preference for no AI.

The preview demonstrates Jobbely's reading order and extraction, not a vendor-equivalent ATS verdict. Complex layouts can cause partial interpretation; the candidate should see and correct that failure. [Greenhouse's parsing guidance](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) documents several such layout limitations.

## Patterns and boundaries

| Pattern            | Proposed responsibility                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Adapter            | PDF/DOCX/text extraction into canonical text spans, section hints and warnings           |
| Strategy           | Contextual skill detection, employer resolution and date parsing policies                |
| Pipeline           | Format validation → extraction → structure → profile → candidate review                  |
| Ports and adapters | Isolated document runner behind an extraction port; fake documents for application tests |
| Composition root   | Explicit adapter/policy/clock wiring in backend bootstrap                                |

Use simple pure functions for internal policies. Do not implement a broad parser superclass or make every helper an interface. Adapters may expose unavailable layout metadata explicitly; PDF page coordinates and DOCX paragraphs are not equivalent evidence.

## Proposed canonical records

| Record                 | Fields and purpose                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ResumeDocument`       | Format, normalized text, spans, page/paragraph references, warnings, extraction version                                 |
| `EvidenceReference`    | Text excerpt, stable span ID/offsets, source kind, rule/version, extraction status                                      |
| `CandidateProfile`     | Employment, skills, competencies, education, qualifications, current location; separate display-only contact fields     |
| `EmploymentEntry`      | Original/canonical employer, title, role function, work location, direct/client relationship, dates/precision, evidence |
| `SkillEvidence`        | Canonical concept, original alias, section/context, mentioned/learning/negated/work-evidenced/user-confirmed status     |
| `CompetencyEvidence`   | Explicit action/achievement supporting a competency; no personality or title-based inference                            |
| `ExperienceSummary`    | Analysis date, interval union, total and relevant months/ranges, internship subtotal, unknown intervals                 |
| `CandidatePreferences` | Desired functions, destinations, workplace modes, relocation and optional employer-context switch                       |

Evidence certainty is a rule label such as `explicit`, `ambiguous` or `user_confirmed`; it is not an uncalibrated percentage. The original excerpt remains accessible. User corrections produce a new in-tab profile revision with their own provenance; they cannot silently rewrite source evidence.

Normalize Unicode and whitespace conservatively with an offset mapping. Deduplicate canonical skill mentions while preserving distinct supporting examples. Preserve unfamiliar values instead of forcing an incorrect taxonomy match. Parse contact details only for the preview; do not send them to matching.

## Chronology invariants

Compute elapsed professional experience from the union of dated employment intervals. Keep projects, education, volunteering and internships distinct. Internal promotions and concurrent contracts cannot inflate total calendar time. Role-relevant experience also uses a union of supported intervals, not a sum.

Use a supplied fixed analysis date for `Present`. Preserve date precision: year-only dates yield bounded durations; missing dates yield unknowns. Adopt half-open month intervals, with the displayed end month included by converting it to the next exclusive month, and document the UI convention. Exact month/day input must not drift through timezone conversion. Do not equate a duration claim with independently calculated work chronology.

A skill in a role does not prove it was used for that role's entire duration. Skill-specific tenure needs dated evidence or user confirmation. Gaps, part-time status and unknown employers do not incur penalties; part-time duration is calendar time unless explicit workload data supports a separate FTE metric.

## Recognition and location

Employer aliases are resolved inside employment sections only. Recognize direct employment separately from client assignments; ambiguous aliases remain unresolved. Keep company recognition separate from competency evidence and from the optional ranking policy in [MATCHING](MATCHING.md).

Current candidate location requires header evidence or confirmation. Employment cities and educational locations do not substitute for it. Preserve ambiguous cities, remote-country restrictions and willingness to relocate separately. No live geocoding requests or external profile lookup are needed in MVP.

## Dependencies and verification

Evaluate [PDF.js](https://mozilla.github.io/pdf.js/getting_started/) and [Mammoth](https://github.com/mwilliamson/mammoth.js) in the spike, pin versions after validation, and retain format regression fixtures. Mammoth's unsanitized output must never be directly rendered; use bounded text/structure extraction with external file access disabled. Resource isolation and private-state rules belong in [RESUME_PRIVACY](RESUME_PRIVACY.md).

Implemented modules and tests are linked in [the testing guide](RESUME_TESTING.md). Future document adapters belong in the paths listed in [the plan](../RESUME_PLAN.md). Integration points are [bootstrap](../backend/src/bootstrap.ts), [resume schemas](../backend/src/api/resume-schemas.ts) and [frontend](../frontend/src/App.tsx). Retain generated-contract and dependency-boundary checks.

Verification requires representative text PDF/DOCX fixtures, column/table/header failures, alias collisions, date precision/overlap cases, negated/learning skills and candidate correction provenance. Report extraction precision/recall by supported function; do not claim complete skill coverage from a few successful sample documents.
