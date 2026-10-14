# Decision: opt-in AI resume alignment with a selected role

**Status:** Implemented 15 October 2026 (Europe/Amsterdam). Local Sol 6.1 compatibility checked with fictional candidate input. Independent quality calibration and production subscription/provider launch gates remain pending.

## Rationale and boundaries

Job-detail comparison offers **Assess with AI** for active Pro users with a current reviewed resume. It assesses selected ATS keyword/qualification overlap and recruiter experience/contribution evidence against the stored public description. It reviews original resume text, not profile corrections, and cannot change deterministic qualification fit, coverage, ranking, candidate claims or activity tenure. The existing comparison works independently of AI availability or failure.

An employer's actual ATS configuration, knockout questions and recruiter decisions are unknown. The module reports qualitative alignment and evidence confidence, never an ATS/recruiter pass probability, hiring prediction or automatic screening decision. It does not assess file parsing. Missing resume evidence is not proof of missing ability. Advice must be reviewed and added only when factual.

## Contracts, access and privacy

[POST `/api/v1/jobs/:id/resume-assessment`](../backend/src/api/resume-review-routes.ts) accepts bounded resume text and literal `aiConsent: true`. The server resolves the job through its catalog; clients cannot replace its description or submit account/plan claims. The route shares the resume reviewer's active session, exact Origin, CSRF, server-owned unexpired Pro capability, post-work access recheck, silent logging and `no-store` controls. Missing jobs return a generic 404 before model admission. [Schemas](../backend/src/api/role-assessment-schemas.ts) own the strict contract; regenerate frontend types with `pnpm contracts`.

Resume input is limited to 40,000 characters and 2,000 lines. [The workflow](../backend/src/application/resume/review-resume.ts) omits the first nonempty resume line and obvious contact/URL/location lines. The authoritative job document is minimized similarly and capped at 24,000 characters. This is not complete anonymization. Original file bytes remain local; Jobbely does not persist candidate inputs/results. Provider/account retention controls and the development subprocess boundary remain owned by [RESUME_REVIEWER](RESUME_REVIEWER.md) and [RESUME_PRIVACY](RESUME_PRIVACY.md).

The button is explicit per-request consent with nearby OpenAI processing information. Requests never start on navigation or profile analysis. [RoleAlignmentAssessment](../frontend/src/features/resume/RoleAlignmentAssessment.tsx) binds results to job, original text and account identity. Source/profile changes, clear, identity/CSRF change, unavailable access and unmount clear or release feedback and cancel pending work. Focus and access-expiry checks refresh availability. Cancellation retains deterministic comparison. State is React memory only.

Both writing review and role assessment use the same configured [provider](../backend/src/infrastructure/resume/reviewer-factory.ts), transport limits and shared admission: five attempted AI requests/hour/account, one active/account, four/process. The local Codex adapter additionally permits one subprocess at a time across both actions. Failed/cancelled attempts count; quotas are process-local, not durable across replicas. Hosted production remains subject to the reviewer's billing, retention, isolation and budget gates.

## Evidence and confidence

[The provider contract](../backend/src/infrastructure/resume/role-contract.ts) requests two to eight observations covering both areas, each with an exact nonempty job quote. Supported/partial observations must also quote an exact passage at its supplied original resume line. Missing-evidence observations must have null resume quote/line. [Domain validation](../backend/src/domain/resume/role-assessment.ts) rejects the entire result for invented/mislocated quotes, duplicated area/job quotes or absent areas. Invalid/refused/truncated provider output returns unavailable feedback; it cannot inflate alignment by silently dropping a gap.

The application derives each area's summary from these selected observations:

- Strong overlap: at least two observations, all supported. Partial overlap: some quoted resume evidence. Limited evidence: none quoted.
- High evidence confidence: all observations supported, at least three distinct quoted resume lines, and no shortened job context. Moderate: some verified resume quotation. Low: none. Shortened job context caps confidence at moderate.

These are presentation rubrics for grounded evidence, not calibrated semantic certainty or screening odds. Exact quotes cannot prove the model's interpretation, complete requirement coverage or factual advice. The result includes those limits and separates original job/resume excerpts from suggestions. Neither prompt instructions nor strict schema guarantee resistance to every instruction embedded in document text.

## Match presentation

The shared score component retains qualification fit and assessed/identified coverage with its unassessable count. Duplicate **About these scores** guidance, standalone gaps/check-time paragraphs and the detail comparison source disclosure are removed. On desktop the smaller **Why this result** control sits to the right of metrics; expanded evidence fills the row. It moves below them on narrow screens. Original employer/application links and recommendation availability gates remain.

The legend uses rounded **Full match 100%** and **Partial or uncertain 25%** chips. Zero-credit purple/red legend entries are omitted. Actual purple/red evidence, questions, description highlights and zero-credit scoring remain. [MATCHING](MATCHING.md#color-weighted-qualification-fit-9-october-2026) and [SKILL_RELATIONS](SKILL_RELATIONS.md) own those policies.

## Verification

[Domain tests](../backend/src/domain/resume/role-assessment.test.ts) cover exact provenance, invalid/duplicate/incomplete output, distinct-line confidence and shortened context. [Route tests](../backend/src/api/resume-review.test.ts) cover authoritative job lookup, minimization, consent, unknown jobs, guest/Free access, Origin/CSRF, invalid model evidence, shared hourly admission and post-work entitlement revocation. Both [OpenAI](../backend/src/infrastructure/resume/openai-review.test.ts) and [Codex](../backend/src/infrastructure/resume/codex-review.test.ts) suites exercise the new schema through existing bounded transports. [Metric tests](../frontend/src/features/resume/match-metrics.test.ts) preserve nullable/down-rounded scores after removing help guidance.

On 15 October a real `gpt-6.1-sol` workflow call returned six valid observations from fictional resume text and a stored public job, with partial overlap/moderate evidence confidence in each area. This establishes installed CLI/account compatibility, not model-quality calibration. A separate in-memory fictional browser fixture verified AI loading, cancellation, grounded overlap/gaps, desktop summaries and stacked mobile cards without horizontal overflow. It used a delayed fake provider; no real candidate was transmitted or captured in artifacts.

Root `pnpm check` passed formatting, boundaries, assets, zero-warning lint, strict types, regenerated contracts and both production builds, with 919 backend and 47 frontend tests passing. The 39 database/queue tests were skipped without `TEST_DATABASE_URL`; this increment changes no persistence. Documentation links and `git diff --check` passed. Desktop keyboard expansion placed the explanation beside metrics on the same baseline; mobile content had equal document/scroll widths of 380px and full-width expanded evidence. Navigation during AI work removed old results. Temporary fixture servers/files and viewport overrides were cleaned up.

Database tests skipped without a dedicated test database do not establish database correctness. Production release still needs supported billing projection and independent evaluation across resume/job languages, including adversarial text and missing qualifications.
