# Decision: deterministic resume analysis and review

**Status:** Pasted text, local PDF/DOCX extraction, profile correction and initial explained matching implemented. Recorded 1 October 2026, Europe/Amsterdam. Product history: [RESUME_PLAN](../RESUME_PLAN.md); checks: [RESUME_TESTING](RESUME_TESTING.md).

## Structured evidence update, 2 October 2026

[STRUCTURED_MATCHING](STRUCTURED_MATCHING.md) records the implemented job sections, logical resume blocks, required/preferred/additional groups and bounded source-reference contracts. Analysis is text-3; public features are requirements-13:concepts-2:clauses-2:job-document-1, scoring score-4:relations-3. Single-job comparison exposes completeness, review band and unresolved counts. Matching forwards only allowlisted evidence metadata; resume excerpts remain transient. Earlier dated verification below describes its own increment.

## Pipeline and layers

PDF and DOCX are separate [local document adapters](DOCUMENTS.md). They produce text, ordered reading blocks and warnings in an isolated browser worker. Candidates explicitly request analysis of the selected file, then edit the resulting profile. Pasted text remains editable and uses the same bounded text-analysis contract. Backend domain policies remain pure; `AnalyzeResume` orchestrates extraction/corrections without IO or persistence. The frontend consumes generated API types and never imports backend internals.

The [text reader](../backend/src/domain/resume/document.ts) preserves line order and offsets into CRLF-normalized text. English headings inform section detection. [The vocabulary](../backend/src/domain/resume/vocabulary.ts) now contains 59 skill concepts and four explicit competency rules, covering an initial engineering/data/product/sales/people set. Named aliases, contextual collision guards, negation and learning states retain evidence; unknown skills can be added manually. This is a reviewed starter set, not universal skill coverage.

The profile shows Jobbely's interpretation, not an exact simulation of a vendor ATS or an employability verdict. Work-evidenced and user-confirmed claims do not verify proficiency. Raw reading previews and per-claim evidence/confirmation controls are omitted; contact text is not a matching field.

## Records and corrections

The [domain model](../backend/src/domain/resume/model.ts) separates document lines, skills/competencies, employment entries, current location, duration bounds, warnings and versions. Evidence references retain line IDs/excerpts/rules. Original employer/date headers are excluded from skill extraction: employment at Figma or Salesforce does not itself establish tool proficiency.

Corrections replay with the original text and fixed analysis date. They can add/remove/confirm skills and competencies, edit location and employment, or add manual roles. Original evidence remains in transient analysis metadata; confirmation has its own status. Skills and competencies share removable keyword chips. Employer recognition is restricted to employment fields and the configured company registry; title-only familiarity is not employment. As of `text-4` (5 October), ordinary extracted experience and newly added roles default to direct employment; explicit freelance, client, contractor, contract or self-employed headers default to client work. Projects/volunteering retain unknown relationships. These defaults remain editable. Trailing Full-time/Part-time qualifiers are stripped from titles while original evidence is retained.

Dates support month/year, ISO month, numeric month/year, year-only ranges and Present. Experience unions overlaps rather than adding promotions/parallel roles twice. Professional employment, internships and other activity remain separate. Relevant duration uses reviewed functions; missing/reversed/future intervals remain uncertain. No skill-specific years are inferred from total career tenure. As of `text-6` (5 October), direct skill usage linked to employment yields a separate, labeled full-role estimate. Overlaps count once, coarse dates retain bounds and explicit/manual years override estimates. Inferred activities and standalone skill lists receive no estimated years. See [QUALIFICATIONS](QUALIFICATIONS.md) for review and matching limits.

The `text-2` employment policy accepts company/title headers separated by `|`, `at`, `@` or spaced hyphen/en/em dashes, with dates on the same or following line. It recognizes SWE/SDE/CTO and founder titles; explicitly technical founders map to engineering while generic founders remain unclassified. Company names containing a role word do not automatically become the title. Multiline headers retain all contributing evidence lines. Bounded header checks reject bullet/responsibility prose as a date's employer/title, and unassociated dated experience produces an incomplete-total warning. These English heuristics still require candidate review; education years never establish employment. Updated 1 October 2026.

Location extraction uses the header, not former work locations. Ambiguous/missing locations stay uncertain; authorization, relocation and language are not inferred. The 5 October [qualification update](QUALIFICATIONS.md) implements degree level/subject/completion and explicit skill-year extraction with editable review. Richer academic fields, structured authorization/language review, multilingual parsing, OCR and richer employer-domain weighting remain follow-ups. Current analysis is `text-5`; the engineering registry includes 239 skill concepts and nine competencies, with conservative technical collision guards.

## Matching and state

Clicking Find matching jobs confirms the current profile for matching and description comparisons; there is no separate review checkbox. [Matching](MATCHING.md) sends only allowlisted claims/dates/location, recomputes tenure and returns requirement evidence, gaps, comparisons, uncertainty, source coverage and freshness. Optional same-employer/function continuity is capped and cannot override gaps. Closed/demo/stale/missing/failed-source jobs are excluded.

State lives only in the current tab. Analysis corrections debounce by 350 ms and abort superseded requests. Editing the profile/preferences invalidates recommendations, review confirmation and pagination; pending/error analysis cannot be matched. Clear cancels document and network work. See [privacy](RESUME_PRIVACY.md).

## Implementation and verification

[Analysis workflow](../backend/src/application/resume/analyze-resume.ts), [text API](../backend/src/api/resume-routes.ts), [workbench](../frontend/src/features/resume/ResumeWorkbench.tsx), [editing hook](../frontend/src/features/resume/useResumeAnalysis.ts), [employment editor](../frontend/src/features/resume/EmploymentReview.tsx), [signal editor](../frontend/src/features/resume/SignalReview.tsx).

Synthetic evaluation covers skill aliases/collisions, employer distinctions, status/provenance, overlap/date bounds, input limits and corrections. Format tests compare equivalent PDF/DOCX output. Matching tests separately exercise each supported function. The current corpus is a reproducible regression set, not a held-out precision/recall benchmark; unsupported layouts/requirements need explicit review rather than a fabricated accuracy claim.

Engineering semantic matching now distinguishes full (green), partial (yellow), suggested (purple, zero credit) and absent/denied (red) coverage. Scoped tool-usage/development answers stay transient and invalidate profile review and pagination. Matching accepts bounded semantic metadata, never resume excerpts. See [SEMANTICS.md](SEMANTICS.md) for the implemented registry, context guards, confirmation flow and limits.
