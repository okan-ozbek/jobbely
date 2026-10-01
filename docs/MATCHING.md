# Decision: explained, stateless job matching

**Status:** Implemented initial deterministic matching across engineering, data/AI, product, sales and people. Recorded 1 October 2026, Europe/Amsterdam. Calibration on a held-out corpus and distributed load testing remain pending.

## Decision and rationale

Match a reviewed structured profile against features extracted from stored public descriptions. No AI, external profile enrichment, saved candidate record or provider request occurs during matching. The first complete flow is pasted/file-extracted text → analysis → corrections → explicit review confirmation → recommendations → original description/application.

The strict request contains only skill and optional competency IDs/statuses, employment employer/function/kind/relationship/dates, current location/status and analysis date. It excludes full document text, contact fields and resume excerpts. Tenure is recomputed on the server; submitted duration totals and recognized employer IDs are not accepted.

## Requirements

[Extraction](../backend/src/domain/matching/requirements.ts) uses English headings and explicit cue rules. Required, preferred and contextual statements remain separate. “We use Python” is contextual; “Java or Kotlin” contributes one alternative group. Comma-separated alternatives are grouped when connected by “or”; conjunctions contribute separate requirements. Recognized aliases share the resume vocabulary.

Thresholds retain minimum months, required/preferred importance, professional/function/skill scope and original line/excerpt. Skill-specific years and explicit team-management tenure are unresolved because the profile has no reviewed intervals for those activities; general engineering tenure does not establish management years. Location, authorization, qualification and language statements retain evidence. Unsupported mandatory statements, including residual terms in partly recognized skill clauses, are returned as `unparsed` and require review. This conservative grammar may also flag legitimate complex statements; it never establishes complete requirement coverage.

Extraction rejects interpretation of descriptions over 200,000 characters, and bounds features to 200 skill groups, 30 thresholds and 40 constraints/unparsed statements each. Exceeded limits set `truncated` and prevent confident fit bands. The public requirements route displays the same policy beside the sanitized original description, including closed-job details.

## Scoring and uncertainty

[Scoring](../backend/src/domain/matching/score.ts) uses these dimensions:

| Dimension      | Weight | Current assessment                                                               |
| -------------- | -----: | -------------------------------------------------------------------------------- |
| Skills         |     50 | Required group weight 3, preferred 1; best alternative contributes once          |
| Experience     |     20 | Professional/function month union compared with extracted thresholds             |
| Function       |     15 | Reviewed professional role functions; unknown functions unassessed               |
| Location       |     10 | Conservative exact normalized location overlap; explicit restrictions unresolved |
| Qualifications |      5 | Unassessed; explicit mandatory statements require review                         |

Work-evidenced and user-confirmed skill claims receive credit 1, listed mentions 0.6, learning/negated/absent claims 0. They remain claims rather than verified proficiency. Missing evidence does not establish lack of ability. A mandatory group below full credit is a required gap.

[Weighted relations](SKILL_RELATIONS.md) can provide capped partial credit from related claims. Green direct matches, orange uncertain/related evidence and red missing evidence appear in recommendation explanations and an optional keyword overlay on the full description. Each inferred result exposes its source, path, edge reasons and evidence weight. Relations never establish experience duration or satisfy a mandatory skill at partial credit. “Our ideal … will have” sections are required; industry and group-leadership thresholds remain independent, including a 7-year industry / 2-year leadership statement.

Experience uses overlap-aware bounds. A minimum bound above the requirement is met; a maximum below it with no unknown intervals is below; other cases are uncertain. Internships, projects and volunteering do not become professional tenure. No overqualification penalty applies.

For each dimension, base fit is the weighted credit divided by assessed weight, expressed out of 100. Completeness is the assessed fraction of the full 100-point policy. Unparsed statements reduce skill coverage by their required/preferred weights. Neither number is extraction accuracy or a hiring probability. No recognized mandatory comparison, completeness below 60%, truncation or unresolved mandatory constraints produces `review`. Required gaps produce `exploratory`; otherwise scores 80+ are `strong`, 60+ `possible`, lower `exploratory`.

Remote does not establish worldwide eligibility. Different cities sharing a country do not establish overlap. Work authorization, relocation, qualifications and languages are not guessed from a location or education heading. These fields currently remain review items rather than editable structured eligibility claims.

## Optional employer context

Off by default. A reviewed direct professional role in the **same target employer and function**, with a positive known duration, may add 3 points. This narrow continuity policy replaces the proposed broader prestige/domain weighting; it does not rank companies by reputation. Client assignments, unknown relationships, undated roles and unknown employers receive no adjustment or penalty.

Adjustment is separate from base fit and completeness. It applies only without required gaps and outside `review`, cannot change the fit band, and is capped below the planned 5-point ceiling. Sorting happens within bands by base plus adjustment, completeness, freshness, then stable posting ID. Policy version and reason are returned. No score or experience year is inflated by a company name.

## Availability, pagination and capacity

Only active, not-observed-missing postings are eligible. Demo mode returns no recommendations. Their latest completed source run must be successful, exhaustive and not quarantined, and both run completion and last observation must be within 36 hours. Candidate boards may participate with explicit partial/unconfirmed coverage labels. Verified scope does not guarantee that an individual job remains open at the employer.

[The use case](../backend/src/application/resume/match-jobs.ts) scans eligible indexed feature rows in batches of 250 and retains only the next 1–50 results plus one sentinel. It reports eligible/evaluated/unenriched counts and excluded source count. It rejects more than 50,000 eligible jobs or a scan over 10 seconds, rather than silently considering a prefix. Two matching requests may execute concurrently per API process; admission is 15/minute per actual connection IP with at most 1,000 tracked windows.

Signed cursors are submitted in the POST body and bind profile/preferences, dataset version, feature generation, latest completed run evidence, analysis date and policy versions. The freshness reference is fixed for pagination; cursors expire after 15 minutes. Edits, job/run/feature changes or in-flight changes require restart (409). Requests are reranked without storing private result sets. `MATCH_CURSOR_SECRET` can share a random 32+ character signing key across API replicas; without it, restart/another replica invalidates cursors. Edge limits remain necessary for shared deployments.

## Implementation and verification

[Feature storage/backfill](JOB_FEATURES.md), [privacy](RESUME_PRIVACY.md), [API schemas](../backend/src/api/matching-schemas.ts), [routes](../backend/src/api/matching-routes.ts), [UI](../frontend/src/features/resume/ResumeMatches.tsx), [testing guide](RESUME_TESTING.md).

Tests cover alternative groups, contextual mentions, unsupported requirements, each supported function, date uncertainty, optional context, availability, signed pagination and concurrent changes. A 25,000-row synthetic feature scan exercises bounded retrieval and ranking; it is not a production concurrency benchmark. Catalog search still uses its existing full-snapshot path; indexing this matching path does not migrate the general catalog.
