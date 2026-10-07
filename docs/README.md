# Architecture reference index

Recorded: 30 September 2026. These references describe the current first implementation slice. Read [the root README](../README.md) for setup and hosting, and [the MVP plan](../MVP_PLAN.md) for product boundaries.

## Decisions by concern

The 7 October [account deletion increment](ACCOUNTS.md#permanent-account-deletion-7-october-2026) adds permanent deletion, recent-sign-in/Origin/CSRF guards, atomic account/native-mail cleanup and transient browser state clearing.

[SYNTHESIA.md](SYNTHESIA.md) records official public Ashby widget discovery, 44 specific jobs with native compensation, one general-application exclusion and scheduled refreshes, retaining partial inventory/attribution coverage and pending employer reviews.

[LINEAR.md](LINEAR.md) records public Ashby reuse, native UUID and board-alias reconciliation, 31 imported jobs and seven regional identity gaps, retaining partial coverage, pending employer review and enabled schedules.

[SUPABASE.md](SUPABASE.md) records official Ashby reuse, 51 jobs with native compensation, talent-form identity handling and exact-run technical coverage, retaining pending employer reviews and enabled schedules.

[RUNWAY.md](RUNWAY.md) records canonical careers discovery, 45 Ashby jobs with native pay, exact-run identity matching and scheduled refreshes, retaining unresolved Studios/Talent Network coverage and pending employer review.

[ELEVENLABS.md](ELEVENLABS.md) records public Ashby reuse, native UUID/case-alias reconciliation, 137 imported jobs and exact-run technical coverage, retaining pending employer review and enabled schedules.

[LOVABLE.md](LOVABLE.md) records official-detail-linked Ashby reuse, 80 jobs with native compensation, exact-run evidence and scheduled refreshes, with independent inventory and employer reviews pending.

[REPLIT.md](REPLIT.md) records official-linked Ashby reuse, 70 imported jobs with native pay and exact-run evidence, pending employer review and enabled scheduled refreshes.

[SCHEDULING.md](SCHEDULING.md) records the application-owner request enabling all configured source schedules independently of verification, with unchanged access, coverage and closure gates.

[ANYSPHERE.md](ANYSPHERE.md) records Cursor’s employer-embedded Ashby source, 132 authorized local imports and exact-run evidence, retaining pending employer review and independent visible-identity reconciliation.

[PERPLEXITY.md](PERPLEXITY.md) records public Ashby reuse, 130 imported jobs with native compensation and exact-run evidence, separating collection from challenged official careers/policy access and unverified independent inventory.

[HUGGING_FACE.md](HUGGING_FACE.md) records public Workable support, five imported vacancies, the Wild Card exclusion and exact-run reconciliation against the advertised Markdown inventory, with employer scope/access/display reviews pending.

[COHERE.md](COHERE.md) records the current Ashby board, native compensation retention and 130 locally imported jobs following explicit application-owner authorization, with independent coverage and employer access/display review pending.

[MISTRAL_AI.md](MISTRAL_AI.md) records current Ashby source discovery, safe dotted board support, scoped legal evidence and 208 imported vacancies with independent coverage/access/display review still pending.

[VERCEL.md](VERCEL.md) records public Greenhouse reuse, native official posting-ID reconciliation and 83 imported vacancies, separating verified technical coverage from pending scope/access/display reviews.

[NOTION.md](NOTION.md) records public Ashby reuse, 133 imported vacancies and matching official IDs, with technical verification separate from pending scope/access/display reviews.

[CANVA.md](CANVA.md) records public SmartRecruiters reuse, Canva advertisement/summary layout compatibility and challenged independent official coverage.

[ASML.md](ASML.md) records the full-description publication/source gate, observed terms and unresolved current inventory; no ASML jobs have been imported.

[ADYEN.md](ADYEN.md) records reuse of the public Greenhouse board, 228 imported vacancies and independent interactive-pagination coverage limits.

[SERVICENOW.md](SERVICENOW.md) records public SmartRecruiters collection, full detail hydration and the challenged official-inventory coverage boundary.

[HUBSPOT.md](HUBSPOT.md) records the unavailable public careers service and explicit candidate failure gate; no HubSpot jobs have been imported.

[TECH_COMPANIES_500.md](TECH_COMPANIES_500.md) tracks a global 500-employer technology shortlist for one-company-at-a-time onboarding, with a [JSON backlog](TECH_COMPANIES_500.json), current registry matches, discovery-evidence levels and an ordered onboarding queue. [ATLASSIAN.md](ATLASSIAN.md) records the first candidate integration and its missing-description import blocker. [SHOPIFY.md](SHOPIFY.md) records the second native integration, full public detail hydration and independent visible-inventory coverage limits; source approvals remain pending.

[AUTOMATIC_COVERAGE.md](AUTOMATIC_COVERAGE.md) records automatic technical verification, pagination, persisted run/configuration-bound results and live checkmarks. Access/display review and legacy removal activation remain separate from technical coverage.

[WAVE_REFRESH.md](WAVE_REFRESH.md) records the automated A → B → C ingestion/audit cycle, exclusive queue, exact snapshot reuse, persisted progress and unchanged source verification/lifecycle gates.

[DOCKER.md](DOCKER.md) records the implemented local container stack: static frontend, API, migration job, PostgreSQL and optional ingestion/email workers. The document parser remains in the browser and is served with its required isolation headers.

[ACCOUNT_BILLING_PLAN.md](ACCOUNT_BILLING_PLAN.md) tracks five free resume matches, native and GitHub/LinkedIn sign-in, US$7.95 monthly Pro, Stripe and administration. [ACCOUNTS.md](ACCOUNTS.md) records the implemented account/session/dialog and draft-offer foundation. [EMAIL_ACCOUNTS.md](EMAIL_ACCOUNTS.md) records password registration, email verification/reset codes, durable admission and the separate SMTP queue worker. Paywall enforcement, Stripe, admin controls and analytics remain pending.

[ANALYTICS_PLAN.md](ANALYTICS_PLAN.md) proposes admin audience, registration, observed DAU/WAU/MAU, funnel, retention, billing and health reporting, with explicit metric definitions, privacy/consent boundaries and aggregation checks. Analytics remains unimplemented.

[SEMANTIC_EXPERIMENTS.md](SEMANTIC_EXPERIMENTS.md) records the first implemented foundation: requirement/evidence contracts, pure coverage algebra, reproducible development evaluation and a pinned local-model public-job shadow adapter. Live recommendations still use the deterministic policy.

[RESUME_MATCHING_REWORK.md](RESUME_MATCHING_REWORK.md) is the proposed implementation roadmap from 4 October 2026: current-code findings, backend-hosted semantic models, evidence comparison, coverage percentages, evaluation gates and phased migration. It supersedes the remaining sequences in the older matching proposals; the implementation references below still describe the current deterministic behavior.

[SKILL_RELATIONS.md](SKILL_RELATIONS.md) defines directed evidence relations, confidence colors, description annotations and their privacy/version invariants.

[QUALIFICATIONS.md](QUALIFICATIONS.md) records degree/skill-year comparisons and bounded responsibility relevance added on 5 October 2026. [MATCHING.md](MATCHING.md#assessment-coverage-update-5-october-2026) defines distinct identified-criterion coverage, separate fit/coverage labels and coverage-adjusted ranking within review bands.

[SEMANTICS.md](SEMANTICS.md) describes the implemented engineering registry, clause interpretation, four coverage states and scoped confirmation flow. [SEMANTIC_MATCHING_PLAN.md](SEMANTIC_MATCHING_PLAN.md) retains the remaining evaluation and expansion roadmap.

[LLM_MATCHING.md](LLM_MATCHING.md) records reproduced structure/context failures and proposes three qualification groups, structured sentence evidence and a gated optional local-model experiment. Stages 1-3 are implemented in [STRUCTURED_MATCHING.md](STRUCTURED_MATCHING.md); the optional model experiment remains proposed.

| Reference                                        | Decisions and responsibilities                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [ARCHITECTURE.md](ARCHITECTURE.md)               | Modular monolith, separate packages/processes, dependency direction, ports and composition root        |
| [ADAPTER.md](ADAPTER.md)                         | Provider adapters, canonical extraction contract, validation, pagination and provider extension        |
| [WAVE_B.md](WAVE_B.md)                           | Enterprise ATS integration, capped search traversal, employer filters and restricted-source limits     |
| [WAVE_C.md](WAVE_C.md)                           | Priority native boards, structured HTML, Amazon partitions and access gates                            |
| [WAVE_D.md](WAVE_D.md)                           | Seven deferred employers, planning membership and future onboarding boundaries                         |
| [RESUME.md](RESUME.md)                           | Deterministic text analysis, evidence, editable profiles and complete initial matching flow            |
| [DOCUMENTS.md](DOCUMENTS.md)                     | Local PDF/DOCX adapters, reading order, parser boundaries and format regression checks                 |
| [SEMANTICS.md](SEMANTICS.md)                     | Engineering concept packs, clause evidence, tool scopes and transient skill-discovery review           |
| [STRUCTURED_MATCHING.md](STRUCTURED_MATCHING.md) | Job sections, logical resume blocks, qualification logic and bounded sentence provenance               |
| [MATCHING.md](MATCHING.md)                       | Requirement evidence, explained scoring, freshness, pagination and optional employer context           |
| [QUALIFICATIONS.md](QUALIFICATIONS.md)           | Reviewed degrees, role-based skill estimates, privacy bounds and contextual role relevance             |
| [JOB_FEATURES.md](JOB_FEATURES.md)               | Indexed public features, hash/version invalidation, replayable backfill and publication races          |
| [RESUME_PRIVACY.md](RESUME_PRIVACY.md)           | Transient profiles, local worker CSP, resource bounds and private API handling                         |
| [INGESTION.md](INGESTION.md)                     | Application-owned workflow, atomic publication, operator commands and PostgreSQL-backed scheduling     |
| [STORAGE.md](STORAGE.md)                         | PostgreSQL/Prisma, repository and unit of work, leases, JSON evidence and version history              |
| [CLASSIFICATION.md](CLASSIFICATION.md)           | Taxonomy, ordered strategies, company overrides, ambiguity and explainable decisions                   |
| [LIFECYCLE.md](LIFECYCLE.md)                     | Source identity, content hashing, missing observations, closure and removal quarantine                 |
| [HTTP.md](HTTP.md)                               | Shared transport, allowed destinations, pacing, retries and request budgets                            |
| [SECURITY.md](SECURITY.md)                       | External-content trust boundary, HTML sanitization, secrets and public read API                        |
| [API.md](API.md)                                 | Fastify/TypeBox, generated OpenAPI contract, catalog queries, pagination and health routes             |
| [FRONTEND.md](FRONTEND.md)                       | React/Vite, query-keyed results, loading skeletons, cancellable requests and button-confirmed matching |
| [DESIGN.md](DESIGN.md)                           | Resume-first glass UI, four-column company grid, typography, responsive and accessible interactions    |
| [LOGOS.md](LOGOS.md)                             | Reviewed transparent SVGs, source records, manual vector maintenance and the shared N/A fallback       |
| [SOURCES.md](SOURCES.md)                         | Company/source separation, explicit audit status, scheduling gate and coverage signals                 |
| [AUDITING.md](AUDITING.md)                       | Official-ID reconciliation, policy evidence, reviewed scope, activation and verified refresh guards    |
| [QUALITY.md](QUALITY.md)                         | Strict types, dependency checks, behavioral tests and separate integration/live-source gates           |
| [FORMATTING.md](FORMATTING.md)                   | Shared Prettier style, explicit braces, editor defaults, exclusions and formatting gates               |
| [DEPLOYMENT.md](DEPLOYMENT.md)                   | Static frontend, persistent Node API/worker, PostgreSQL, environment and operational recipe            |
| [SOURCE_CHECKS.md](SOURCE_CHECKS.md)             | Dated Wave A feed and official-site checks; not a permanent architecture decision                      |

## How future agents should use these references

The initial resume flow now supports pasted text and local PDF/DOCX extraction, corrections, review confirmation and explained matching for five functions. See [RESUME_TESTING.md](RESUME_TESTING.md) for synthetic regression and manual checks. Browser memory is bounded by inputs/output and termination rather than a per-document OS memory ceiling; deployed CSP, held-out calibration and production load testing remain separate gates.

Read the root [AGENTS.md](../AGENTS.md) first. It defines repository-wide guidance and requires a successful root lint check after the final code edit.

Before changing a concern, read its reference and follow the implementation links. Validate the current code: documentation can drift and is not executable enforcement. Preserve listed invariants unless a deliberate architecture change updates both implementation and documentation.

For a new decision, add an uppercase concern filename with a `.md` extension and record:

1. **Status/date:** implemented, proposed, or superseded; identify the replacement if superseded.
2. **Decision and rationale:** the concrete choice and requirement that motivated it.
3. **Invariants:** behavior that callers and adjacent layers rely on.
4. **Implementation and verification:** links to code, configuration and meaningful checks.
5. **Tradeoffs and extension points:** limits today and where future changes belong.

Update this index, the root README's architecture links, and related references when the design changes. Keep commands, thresholds and environment names aligned with code. Document a proposed feature as proposed until it exists and has been verified; historical source counts belong in dated evidence.

See [QUALITY.md](QUALITY.md) for verification requirements. Avoid duplicating full algorithms across documents: link to the reference that owns the policy.
