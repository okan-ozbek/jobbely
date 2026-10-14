# Decision: paid hybrid resume reviewer

**Status:** Implemented module and gated API, 14 October 2026 (Europe/Amsterdam). Production paid subscription projection and live model evaluation remain pending. All normally configured accounts currently remain Free; sandbox checkout does not unlock this module.

## Rationale and boundaries

Use deterministic checks for observable document problems and optional hosted model feedback for writing. This is separate from profile analysis and job matching. The reviewer cannot change candidate claims, matching scores, qualifications or activity tenure. It reviews the original extracted/pasted text; profile corrections do not rewrite that document.

[Rules](../backend/src/domain/resume/review.ts) check absent email/phone detection, common English/Dutch section headings, repeated/long bullets, bullet marker consistency, reversed year-only ranges, inferred PDF columns/small text heights, DOCX tables and header/footer contact hints. Missing contact details and layout heuristics are risks or suggestions, not proof of rejection. There are no blanket penalties for gaps, photos, page count or education dates. Exact font faces/sizes, margins, color, clipping, images, missing names and comprehensive date consistency are not assessed. Image-only documents retain existing paste-text guidance; OCR remains proposed.

Writing feedback covers spelling, grammar, clarity, contribution and optional job relevance. [The workflow](../backend/src/application/resume/review-resume.ts) requires explicit `aiConsent`; without it no model is called. Model findings must quote an exact nonempty passage at the supplied original line number. Rewrites cannot introduce numerical tokens absent from that quote. Provenance and numerical validation cannot establish that all other facts or advice are correct; the UI labels AI suggestions and asks the candidate to verify them. Provider failure, refusals, truncation and invalid evidence leave document checks visible.

## Paid access and contracts

The user-authorized [temporary local Pro preview](ACCOUNTS.md#temporary-local-pro-preview-14-october-2026) now provides a reversible development exception: active signed-in users can access the reviewer for up to 24 hours after local API startup with `TEMPORARY_PRO_ACCESS=true`. It defaults off, is rejected in production/non-loopback configurations, and does not fabricate subscription/payment records. The original implemented-billing limits below still apply outside this preview. AI configuration and explicit consent remain separate.

[GET/POST `/api/v1/resume-review`](../backend/src/api/resume-review-routes.ts) expose availability and bounded review. POST requires an active session, exact configured Origin, session CSRF and the server-resolved `resume_review` capability with matching ownership and unexpired coverage. Access is rechecked after work. Clients cannot submit account, plan or payment claims. The existing [subscription policy](../backend/src/domain/accounts/access.ts) owns purchased revision capabilities; adding the offer capability does not upgrade historical revisions automatically.

The account read now delegates to the same server access resolver. That resolver still returns Free until reconciled billing is implemented. The UI honestly shows a locked Pro panel and links to the existing sandbox pricing journey. No development bypass, manual account grant, billing migration or production payment collection is introduced. Tests supply synthetic paid resolver results only.

Input is limited to 40,000 resume characters/2,000 lines and 12,000 optional public job-description characters. Layout metadata is bounded local extraction evidence supplied by the browser, not an entitlement or trusted proof of an employer parser. The API uses strict TypeBox schemas, generic nonreflecting errors, silent route logging and `no-store`; regenerated OpenAPI owns frontend types.

## Hosted model and privacy

[The OpenAI adapter](../backend/src/infrastructure/resume/openai-review.ts) uses fixed HTTPS Chat Completions, strict JSON schema, `store: false`, no tools, no retries, a 30-second deadline, at most 3,000 completion tokens, 12 findings and 128 KiB of response bytes. Resume/job text is untrusted data. Prompt instructions and schema conformance do not prove semantic correctness or prevent all prompt injection effects.

Set both `RESUME_REVIEW_OPENAI_KEY` and `RESUME_REVIEW_MODEL` in backend-only environment configuration. No model is selected silently; choose one supporting Chat Completions and strict output after evaluating quality, latency and cost. Neither a real key nor an existing environment file is modified by this implementation. Absent configuration leaves document checks available for entitled accounts and AI disabled. No real candidate text is used in tests or live provider calls.

Original file bytes stay in the local isolated reader. Jobbely stores no reviewer input/results in a database, queue, disk, browser storage or cache. AI consent adds an explicit external text-processing boundary: the first nonempty resume line and obvious contact/URL/location lines are omitted before model transmission. This is minimization, not full anonymization; unlabeled addresses, names and other personal information can remain. The optional job description is minimized similarly. OpenAI API content is not used for training by default, but default abuse-monitoring retention can include content for up to 30 days, with documented exceptions. `store: false` is not a zero-retention guarantee. Review the actual provider/account configuration before launch.

Five AI attempts per account per hour, one active review per account and four active reviews per API process bound local spending. Failed/cancelled attempts count. Admission stores only account IDs/counters temporarily; it is not a shared durable quota across replicas. Shared edge/account admission and an operator provider budget remain production gates. See [RESUME_PRIVACY](RESUME_PRIVACY.md) for the existing isolation/logging boundaries.

## UI and verification

[ResumeReviewer](../frontend/src/features/resume/ResumeReviewer.tsx) offers English UK/US and Dutch, optional target country/job text, unchecked AI consent, document-only review and cancellation. Findings are grouped into errors, risks and suggestions with source/line/page labels. Settings/document changes hide old results immediately and abort work; identity change, clear, unmount and unavailable/revoked access release results. Focus/expiry rechecks access. State stays in the mounted resume tab across SPA navigation and disappears on reload. Nothing automatically rewrites a resume.

Automated synthetic cases cover rule restraint, exact provenance, contact minimization, new-number rejection, provider failure/size/truncation, consent, per-account admission, cancellation, strict API input, Free/guest rejection, CSRF/Origin, wrong ownership, expired/revoked entitlement and post-work access recheck. Frontend document tests verify actual PDF column/small-text hints and DOCX table/header hints. Commands:

```powershell
pnpm --filter @jobbely/backend exec vitest run src/domain/resume/review.test.ts src/application/resume/review-resume.test.ts src/infrastructure/resume/openai-review.test.ts src/api/resume-review.test.ts src/api/accounts.test.ts src/domain/accounts/access.test.ts
pnpm --filter @jobbely/frontend test
pnpm contracts
pnpm typecheck
pnpm lint
```

Browser verification must cover locked guest/Free, synthetic paid document checks, opted-in feedback/failure, edits during work, cancellation, navigation/reload, keyboard controls and narrow layouts. Mock provider tests are not evidence of live model compatibility or writing accuracy. Independent multilingual quality evaluation and production retention/concurrency validation remain pending.

Verification on 14 October: final root `pnpm check` passed formatting, boundaries, assets, zero-warning lint, both strict type checks, regenerated contracts and both production builds. Tests passed 882 backend and 47 frontend cases; 39 database/queue integration cases were skipped without `TEST_DATABASE_URL`. No persistence/schema change was made. Documentation local links and `git diff --check` passed. Isolated loopback browser checks used fictional resumes/accounts and a fake provider: guest/Free locks, document-only findings, explicit AI consent and grounded feedback, provider-failure fallback, cancellation, edits during work, clear, SPA navigation, reload clearing, entitlement loss and keyboard selector dismissal passed. A 390px viewport override reported 380px document width with equal scroll width and no horizontal overflow. Desktop appearance and corrected consent alignment were inspected; the override was reset and temporary fixture servers/files removed. No live model call or paid billing projection was verified.

## Guidance

- [Harvard resume guidance](https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/): clarity, factual achievements and consistency; its verb list does not support arbitrary verb blacklists.
- [CareerOneStop formatting](https://cloudfront.careeronestop.org/JobSearch/Resumes/ResumeGuide/formatting.aspx): readable typography, standard sections and parsing risks.
- [Greenhouse parsing limitations](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse): columns, tables and header/contact issues can require manual correction, not automatic rejection.
- [National Careers Service](https://nationalcareers.service.gov.uk/careers-advice/cv-sections) and [Europass](https://europass.europa.eu/en/create-europass-cv): contextual/country-sensitive guidance.
- [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs), [Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [data controls](https://developers.openai.com/api/docs/guides/your-data): adapter contract and provider retention. Guidance checked 14 October 2026; current provider settings must be verified at deployment.
