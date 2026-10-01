# Decision: deterministic resume analysis and review

**Status:** Pasted text, local PDF/DOCX extraction, profile correction and initial explained matching implemented. Recorded 1 October 2026, Europe/Amsterdam. Product history: [RESUME_PLAN](../RESUME_PLAN.md); checks: [RESUME_TESTING](RESUME_TESTING.md).

## Pipeline and layers

PDF and DOCX are separate [local document adapters](DOCUMENTS.md). They produce text, ordered reading blocks and warnings in an isolated browser worker. Candidates inspect/edit the result and submit the same bounded text-analysis contract used by pasted resumes. Backend domain policies remain pure; `AnalyzeResume` orchestrates extraction/corrections without IO or persistence. The frontend consumes generated API types and never imports backend internals.

The [text reader](../backend/src/domain/resume/document.ts) preserves line order and offsets into CRLF-normalized text. English headings inform section detection. [The vocabulary](../backend/src/domain/resume/vocabulary.ts) now contains 59 skill concepts and four explicit competency rules, covering an initial engineering/data/product/sales/people set. Named aliases, contextual collision guards, negation and learning states retain evidence; unknown skills can be added manually. This is a reviewed starter set, not universal skill coverage.

The preview shows Jobbely's interpretation, not an exact simulation of a vendor ATS or an employability verdict. Work-evidenced and user-confirmed claims do not verify proficiency. Contact text may remain visible in the reading preview but is not a matching field.

## Records and corrections

The [domain model](../backend/src/domain/resume/model.ts) separates document lines, skills/competencies, employment entries, current location, duration bounds, warnings and versions. Evidence references retain line IDs/excerpts/rules. Original employer/date headers are excluded from skill extraction: employment at Figma or Salesforce does not itself establish tool proficiency.

Corrections replay with the original text and fixed analysis date. They can add/remove/confirm skills and competencies, edit location and employment, or add manual roles. Original evidence remains available; confirmation has its own status. Employer recognition is restricted to employment fields and the configured company registry; title-only familiarity is not employment. Direct/client relationships remain unknown until reviewed.

Dates support month/year, ISO month, numeric month/year, year-only ranges and Present. Experience unions overlaps rather than adding promotions/parallel roles twice. Professional employment, internships and other activity remain separate. Relevant duration uses reviewed functions; missing/reversed/future intervals remain uncertain. No skill-specific years are inferred from total career tenure.

The `text-2` employment policy accepts company/title headers separated by `|`, `at`, `@` or spaced hyphen/en/em dashes, with dates on the same or following line. It recognizes SWE/SDE/CTO and founder titles; explicitly technical founders map to engineering while generic founders remain unclassified. Company names containing a role word do not automatically become the title. Multiline headers retain all contributing evidence lines. Bounded header checks reject bullet/responsibility prose as a date's employer/title, and unassociated dated experience produces an incomplete-total warning. These English heuristics still require candidate review; education years never establish employment. Updated 1 October 2026.

Location extraction uses the header, not former work locations. Ambiguous/missing locations stay uncertain; authorization, relocation, language and qualifications are not inferred. Structured review of those eligibility claims, multilingual parsing, OCR and richer employer-domain weighting remain follow-ups.

## Matching and state

The candidate explicitly confirms review before matching. [Matching](MATCHING.md) sends only allowlisted claims/dates/location, recomputes tenure and returns requirement evidence, gaps, comparisons, uncertainty, source coverage and freshness. Optional same-employer/function continuity is capped and cannot override gaps. Closed/demo/stale/missing/failed-source jobs are excluded.

State lives only in the current tab. Analysis corrections debounce by 350 ms and abort superseded requests. Editing the profile/preferences invalidates recommendations, review confirmation and pagination; pending/error analysis cannot be matched. Clear cancels document and network work. See [privacy](RESUME_PRIVACY.md).

## Implementation and verification

[Analysis workflow](../backend/src/application/resume/analyze-resume.ts), [text API](../backend/src/api/resume-routes.ts), [workbench](../frontend/src/features/resume/ResumeWorkbench.tsx), [editing hook](../frontend/src/features/resume/useResumeAnalysis.ts), [employment editor](../frontend/src/features/resume/EmploymentReview.tsx), [signal editor](../frontend/src/features/resume/SignalReview.tsx).

Synthetic evaluation covers skill aliases/collisions, employer distinctions, status/provenance, overlap/date bounds, input limits and corrections. Format tests compare equivalent PDF/DOCX output. Matching tests separately exercise each supported function. The current corpus is a reproducible regression set, not a held-out precision/recall benchmark; unsupported layouts/requirements need explicit review rather than a fabricated accuracy claim.
