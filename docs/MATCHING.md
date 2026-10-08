# Decision: explained, stateless job matching

**Status:** Implemented initial deterministic matching across engineering, data/AI, product, sales and people. Recorded 1 October 2026, Europe/Amsterdam. Calibration on a held-out corpus and distributed load testing remain pending.

## Structured evidence update, 2 October 2026

[STRUCTURED_MATCHING](STRUCTURED_MATCHING.md) records the implemented job sections, logical resume blocks, required/preferred/additional groups and bounded source-reference contracts. Analysis is text-3; public features are requirements-13:concepts-2:clauses-2:job-document-1, scoring score-4:relations-3. Single-job comparison exposes completeness, review band and unresolved counts. Matching forwards only allowlisted evidence metadata; resume excerpts remain transient. Earlier dated verification below describes its own increment.

## Decision and rationale

The 5 October [qualification policy](QUALIFICATIONS.md) extends comparison with reviewed degrees, explicit skill years and at most five contextual responsibility points. The 8 October [vocabulary review](VOCABULARY.md) expands shared recognition; the 9 October increments add testing and platform concepts. Current analysis is `text-6`, public features `requirements-19:concepts-7:clauses-4:job-document-3` and scoring `score-7:relations-3`. The updates below supersede earlier display and dimension-weight completeness policies; authorization and language remain review items.

### Platform qualification follow-up, 9 October 2026

The reported public Notion (`06dcc14e-149b-4229-b579-c20b94242196`) and OpenAI (`d34995ed-a1ea-4a89-acfd-f31daacfc9f8`) descriptions exposed unrecognized qualification/responsibility labels and lost repeated highlights. `Skills You'll Need to Bring` and `You might thrive in this role if you` now establish qualification sections in plain text, heading HTML and bold paragraph labels; `What You'll Achieve` and `In this role, you will` establish contextual responsibilities. `Who We Are`, company AI notes and applicant privacy instructions are informational. Curiosity/explicit lack of an AI-expertise prerequisite does not establish a mandatory AI skill. Mixed tenure plus “and the ability to …” clauses split so the second qualification survives as a review item. Exclusive “based across” locations remain explicit review constraints.

Twenty-one reviewed [platform/collaboration concepts](VOCABULARY.md#platform-and-collaboration-review-9-october-2026) add recognition without transfer edges, proficiency claims or inferred activity years. Existing IDs gain debug/failover/architecture/ownership forms. Generic reliability is separate from fault tolerance/SRE, latency from low latency, and API construction from API design. Undefined bonus domains and unsupported soft qualifications remain reviewable rather than silently counting as met.

Alternative-list review uses recognized source spans from the full sentence, rather than re-recognizing each stripped fragment without its disambiguating context. This keeps Spring in Java context and a recognized AI/ML infrastructure phrase from becoming false unknown routes when split on commas/slashes. Genuine unknown alternatives remain reviewable; commercial marketplace experience alone does not claim engineering marketplace systems.

Description annotations are recognized within each retained clause and use its original canonical offset. They include repeated mentions and named examples while criterion deduplication continues to prevent extra scoring weight. Clause scope prevents neighboring company prose from disambiguating an unrelated word. Qualification groups and colors still reflect candidate evidence, not employer assertions about the candidate.

Verification: [platform contrasts](../backend/src/domain/matching/platform-baseline.test.ts) cover section/layout variants, duties versus qualifications, homonyms, original offsets, bonus alternatives, uncertain skill tenure, and shared fictional resume recognition. [API tests](../backend/src/api/matching.test.ts) verify repeated highlights with one scored criterion and excluded compensation prose. These are development regressions; P1 independent annotation and model comparisons in [ATS_QUALITY_PLAN](ATS_QUALITY_PLAN.md) remain outstanding.

### Qualification baseline, 9 October 2026

Implemented the first repair from [ATS_QUALITY_PLAN](ATS_QUALITY_PLAN.md). The extractor recognizes `Your Expertise` / `A Typical Day` sections and headerless exposure, understanding, degree and English-collaboration cues. Every retained non-heading sentence has a clause disposition (`contextual`, `represented`, `needs-review`) and canonical evidence. This is an auditable rule decision, **not** proof that every real obligation was understood. Unsupported qualification text remains `unparsed`; extraction bounds still apply.

Parenthesized `e.g.`, `for example` and `such as` examples carry `exampleIds`. When a recognized outer capability exists, named examples do not become independent required gaps. A list consisting only of examples contributes one alternative group. The explicit “automated tests or working with a testing framework” construction is one OR group; a named framework or direct automated-test evidence satisfies the recognized route, while another unspecified framework remains reviewable. The job's exposure cue describes a clear minimum rather than an uncertain claim about the candidate; candidate observation/assistance remains uncertain. This bounded policy does not implement arbitrary nested logical alternatives or calibrated proficiency depths. Learning/curiosity cues are contextual; the supported combined “understanding … and eagerness to learn …” wording splits current knowledge from the learning clause. No model interprets arbitrary paraphrases yet.

Bare “or equivalent” keeps the alternative education route uncertain when no reviewed degree meets the stated route. Explicit alternative degree subjects are retained without broadening to all STEM subjects. A nearby welcome for internship/project experience marks an undefined alternative route: below-threshold professional tenure becomes uncertain rather than a rejection or automatic equivalence. Internship/project time is never manufactured as professional or activity-specific tenure.

The API adds nullable `fitScore`. It is the pre-context weighted credit ratio and is returned only when there is a recognized mandatory comparison, every identified criterion has a completed comparison and extraction is not truncated. The UI displays `Needs review` while any identified required/preferred criterion remains unresolved. Display uses one decimal rounded down, so an imperfect ratio cannot round into 100. `baseScore` remains the internal ranking input, including responsibility points; it is no longer the displayed qualification fit. Ordering continues to use bands and coverage-weighted ranking. Full coverage means all **identified** comparisons completed, not validated extraction completeness or a calibrated hiring probability.

Verification: [fictional baseline contrasts](../backend/src/domain/matching/quality-baseline.test.ts), [API serialization](../backend/src/api/matching.test.ts), [display regressions](../frontend/src/features/resume/match-metrics.test.ts). Independent labels, semantic extraction and production calibration remain outstanding.

Match a reviewed structured profile against features extracted from stored public descriptions. No AI, external profile enrichment, saved candidate record or provider request occurs during matching. The first complete flow is pasted/file-extracted text → analysis → corrections → Find matching jobs (confirms the current profile) → recommendations → original description/application.

The strict request contains only skill and optional competency IDs/statuses/facets/interpretation and bounded evidence references, employment employer/function/kind/relationship/dates, degree level/field/completion, explicit reviewed skill months, current location/status and analysis date. It excludes full document text, institution/contact fields and resume excerpts. Career tenure is recomputed on the server; submitted career totals and recognized employer IDs are not accepted.

## Requirements

[Extraction](../backend/src/domain/matching/requirements.ts) uses English headings and explicit cue rules. Required, preferred and contextual statements remain separate. “We use Python” is contextual; “Java or Kotlin” contributes one alternative group. Comma-separated alternatives are grouped when connected by “or”; conjunctions contribute separate requirements. Recognized aliases share the resume vocabulary.

Thresholds retain minimum months, required/preferred importance, professional/function/skill scope and original line/excerpt. Skill-specific years require explicit or manually reviewed durations with direct matching skill evidence; generic engineering tenure and inferred relations do not establish activity/management years. Location, authorization, qualification and language statements retain evidence. Recognized minimum degree requirements are compared separately; complex/equivalent-experience alternatives remain uncertain. Unsupported mandatory statements, including residual terms in partly recognized skill clauses, are returned as `unparsed` and require review. This conservative grammar may also flag legitimate complex statements; it never establishes complete requirement coverage.

Extraction rejects interpretation of descriptions over 200,000 characters, and bounds features to 200 skill groups, 30 thresholds and 40 constraints/unparsed statements each. Exceeded limits set `truncated` and prevent confident fit bands. The public requirements route displays the same policy beside the sanitized original description, including closed-job details.

## Scoring and uncertainty

[Scoring](../backend/src/domain/matching/score.ts) uses these dimensions:

| Dimension  | Weight | Current assessment                                                                |
| ---------- | -----: | --------------------------------------------------------------------------------- |
| Skills     |     50 | Required group weight 3, preferred 1; best alternative contributes once           |
| Experience |     20 | Professional/function month union compared with extracted thresholds              |
| Function   |     15 | Reviewed professional role functions; unknown functions unassessed                |
| Location   |     10 | Conservative exact normalized location overlap; explicit restrictions unresolved  |
| Education  |     10 | Reviewed completed degree level/subject; unknown/equivalent claims require review |

Work-evidenced and user-confirmed skill claims receive credit 1, listed mentions 0.6, learning/negated/absent claims 0. They remain claims rather than verified proficiency. Missing evidence does not establish lack of ability. A mandatory group below full credit is a required gap.

[Weighted relations](SKILL_RELATIONS.md) can provide capped partial credit from related claims. Green direct matches, yellow partial/uncertain evidence, purple zero-credit skill questions and red missing evidence appear in recommendation explanations and an optional keyword overlay on the full description. Each inferred result exposes its source, path, edge reasons and evidence weight. Relations never establish experience duration or satisfy a mandatory skill at partial credit. “Our ideal … will have” sections are required; industry and group-leadership thresholds remain independent, including a 7-year industry / 2-year leadership statement.

Experience uses overlap-aware bounds. A minimum bound above the requirement is met; a maximum below it with no unknown intervals is below; other cases are uncertain. Internships, projects and volunteering do not become professional tenure. No overqualification penalty applies.

For each dimension, base fit is the weighted credit divided by assessed weight, expressed out of 100. Contextual responsibility/role skills add at most five points afterwards, exposed as `roleRelevancePoints`; base fit is capped at 100. Missing contextual skills never create required gaps. Unparsed statements reduce the skills dimension's assessed weight by their required/preferred weights. Unresolved skill alternatives are excluded from assessed fit unless a known alternative fully satisfies the group. No recognized mandatory comparison, assessment coverage below 60%, truncation or unresolved mandatory constraints produces `review`. Required gaps produce `exploratory`; otherwise scores 80+ are `strong`, 60+ `possible`, lower `exploratory`.

### Assessment coverage update, 5 October 2026

The API replaces `completeness` with `assessmentCoverage`: assessed/total criterion counts, a rounded percentage or null, and a `limited` flag for truncated extraction. Recommendations and single-job comparisons use the same [pure coverage policy](../backend/src/domain/matching/assessment-coverage.ts). Coverage is the unweighted fraction of identified required/preferred criteria with completed comparisons. It is independent of scoring-dimension weights and matching success:

- Each skill alternative group counts once. Full, partial and missing skill evidence are assessed outcomes; an unresolved alternative leaves the group unassessed unless a known alternative fully satisfies it.
- Each recognized experience threshold and degree criterion is assessed when its result is met or below; uncertain claims remain unassessed.
- Other explicit constraints (including location restrictions, authorization and language) and unparsed statements remain unassessed. Residual unsupported text in a partly recognized clause counts as one additional unresolved statement, not one criterion per unknown word.
- Repeated criteria count once using stable semantic keys for skills/experience and normalized text for constraints/unparsed statements. Required/preferred importance remains part of identity. Unresolved counts use the same distinct criteria.
- Contextual responsibilities, scoring function and incidental location overlap do not increase coverage. Qualifications absent from the job do not reduce it. No identified criteria or truncated extraction yields a null percentage; truncated results receive zero coverage for ranking even if a retained prefix has comparisons.

The UI separates the review band, **Fit on assessed criteria**, and **Assessment coverage**, with identified-criterion counts and expandable interpretation guidance. It withholds the fit percentage when no criterion is assessed or extraction is limited. A high fit with low coverage remains possible and is explicitly reviewable. Coverage cannot count requirements the parser failed to identify, is not extraction accuracy or confidence, and does not establish proficiency or hiring probability. Independent held-out calibration remains pending.

Remote does not establish worldwide eligibility. Different cities sharing a country do not establish overlap. Work authorization, relocation and languages are not guessed from location or education; they remain review items rather than editable eligibility claims. Degrees and skill years now have explicit review controls; missing evidence remains uncertain rather than a verified absence.

## Optional employer context

Off by default. A reviewed direct professional role in the **same target employer and function**, with a positive known duration, may add 3 points. This narrow continuity policy replaces the proposed broader prestige/domain weighting; it does not rank companies by reputation. Client assignments, unknown relationships, undated roles and unknown employers receive no adjustment or penalty.

Adjustment is separate from base fit and assessment coverage. It applies only without required gaps and outside `review`, cannot change the fit band, and is capped below the planned 5-point ceiling. Sorting preserves strong → possible → exploratory → review bands. Within each band it orders by `(base fit + optional adjustment) × assessed / total`, then exact coverage fraction, base fit, freshness and stable posting ID. The coverage fraction is not rounded for ranking. For example, a 90% fit with 80% coverage ranks above a 100% fit with 50% coverage within the same band. The product is an internal ranking heuristic, not a displayed confidence score; unassessed criteria do not become verified gaps. Policy version and reason are returned. No score or experience year is inflated by a company name. Scoring version changes invalidate old signed cursors; anchors include criterion counts. This scoring-only update needs no feature backfill or database migration.

## Availability, pagination and capacity

Only active, not-observed-missing postings are eligible. Demo mode returns no recommendations. Their latest completed source run must be successful, exhaustive and not quarantined, and both run completion and last observation must be within 36 hours. Candidate boards may participate with explicit partial/unconfirmed coverage labels. Verified scope does not guarantee that an individual job remains open at the employer.

[The use case](../backend/src/application/resume/match-jobs.ts) scans eligible indexed feature rows in batches of 250 and retains only the next 1–50 results plus one sentinel. It reports eligible/evaluated/unenriched counts and excluded source count. It rejects more than 50,000 eligible jobs or a scan over 10 seconds, rather than silently considering a prefix. Two matching requests may execute concurrently per API process; admission is 15/minute per actual connection IP with at most 1,000 tracked windows.

Signed cursors are submitted in the POST body and bind profile/preferences, dataset version, feature generation, latest completed run evidence, analysis date and policy versions. The freshness reference is fixed for pagination; cursors expire after 15 minutes. Edits, job/run/feature changes or in-flight changes require restart (409). Requests are reranked without storing private result sets. `MATCH_CURSOR_SECRET` can share a random 32+ character signing key across API replicas; without it, restart/another replica invalidates cursors. Edge limits remain necessary for shared deployments.

## Implementation and verification

[Feature storage/backfill](JOB_FEATURES.md), [privacy](RESUME_PRIVACY.md), [API schemas](../backend/src/api/matching-schemas.ts), [routes](../backend/src/api/matching-routes.ts), [UI](../frontend/src/features/resume/ResumeMatches.tsx), [testing guide](RESUME_TESTING.md).

Tests cover alternative groups, contextual mentions, unsupported requirements, each supported function, date uncertainty, optional context, availability, signed pagination and concurrent changes. A 25,000-row synthetic feature scan exercises bounded retrieval and ranking; it is not a production concurrency benchmark. The 8 October [catalog increment](STORAGE.md#transaction-and-lease-rules) removes full posting reads from interactive catalog queries. Recommendation routes fetch compact coverage for returned company slugs only; empty results do no coverage read. Scoring, availability, scan limits and cursor binding remain unchanged; compact scoring projections and end-to-end loaded-corpus benchmarks remain pending.

The implemented engineering clause and scoped-review policy is documented in [SEMANTICS.md](SEMANTICS.md). Test C++ → Clang/LLVM questions, usage versus development, confirmation/denial/unsure, five-question bounds and updated-profile review before reranking. The new synthetic corpus is regression evidence; independent held-out precision/recall remains pending.

## Reviewed role estimates, 5 October 2026

The text-6 analysis keeps full-role usage estimates separate from explicit years. Direct skill usage in dated professional roles can supply an estimate, unioning overlaps. Find matching jobs confirms exact estimates as reviewed duration inputs; coarse date ranges require a manually reviewed value. Explicit/manual years override them, including zero. Inferred relations, standalone skill lists and non-professional activities never supply estimated years. Matching request/scoring semantics still use bounded reviewed skill ID/months and direct claims; no new scoring version or public job-feature backfill is required. See [QUALIFICATIONS](QUALIFICATIONS.md).
