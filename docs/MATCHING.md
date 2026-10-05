# Decision: explained, stateless job matching

**Status:** Implemented initial deterministic matching across engineering, data/AI, product, sales and people. Recorded 1 October 2026, Europe/Amsterdam. Calibration on a held-out corpus and distributed load testing remain pending.

## Structured evidence update, 2 October 2026

[STRUCTURED_MATCHING](STRUCTURED_MATCHING.md) records the implemented job sections, logical resume blocks, required/preferred/additional groups and bounded source-reference contracts. Analysis is text-3; public features are requirements-13:concepts-2:clauses-2:job-document-1, scoring score-4:relations-3. Single-job comparison exposes completeness, review band and unresolved counts. Matching forwards only allowlisted evidence metadata; resume excerpts remain transient. Earlier dated verification below describes its own increment.

## Decision and rationale

The 5 October [qualification policy](QUALIFICATIONS.md) extends comparison with reviewed degrees, explicit skill years and at most five contextual responsibility points. Current analysis is `text-6`, public features `requirements-15:concepts-3:clauses-2:job-document-1` and scoring `score-6:relations-3`. The assessment coverage update below supersedes the earlier dimension-weight completeness policy; authorization and language remain review items.

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

Tests cover alternative groups, contextual mentions, unsupported requirements, each supported function, date uncertainty, optional context, availability, signed pagination and concurrent changes. A 25,000-row synthetic feature scan exercises bounded retrieval and ranking; it is not a production concurrency benchmark. Catalog search still uses its existing full-snapshot path; indexing this matching path does not migrate the general catalog.

The implemented engineering clause and scoped-review policy is documented in [SEMANTICS.md](SEMANTICS.md). Test C++ → Clang/LLVM questions, usage versus development, confirmation/denial/unsure, five-question bounds and updated-profile review before reranking. The new synthetic corpus is regression evidence; independent held-out precision/recall remains pending.

## Reviewed role estimates, 5 October 2026

The text-6 analysis keeps full-role usage estimates separate from explicit years. Direct skill usage in dated professional roles can supply an estimate, unioning overlaps. Find matching jobs confirms exact estimates as reviewed duration inputs; coarse date ranges require a manually reviewed value. Explicit/manual years override them, including zero. Inferred relations, standalone skill lists and non-professional activities never supply estimated years. Matching request/scoring semantics still use bounded reviewed skill ID/months and direct claims; no new scoring version or public job-feature backfill is required. See [QUALIFICATIONS](QUALIFICATIONS.md).
