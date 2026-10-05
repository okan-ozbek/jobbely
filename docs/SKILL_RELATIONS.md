# Decision: weighted, directed skill relations

**Status:** Implemented typed partial/suggestion graph, updated 2 October 2026. Weights are reviewed starter policies, not calibrated probabilities. Held-out candidate/job evaluation remains pending.

## Structured evidence update, 2 October 2026

[STRUCTURED_MATCHING](STRUCTURED_MATCHING.md) records the implemented job sections, logical resume blocks, required/preferred/additional groups and bounded source-reference contracts. Analysis is text-3; public features are requirements-13:concepts-2:clauses-2:job-document-1, scoring score-4:relations-3. Single-job comparison exposes completeness, review band and unresolved counts. Matching forwards only allowlisted evidence metadata; resume excerpts remain transient. Earlier dated verification below describes its own increment.

## Decision and rationale

Use a TypeScript adjacency list, with canonical vocabulary IDs as nodes and directed edges containing kind, permitted mode, weight and reason. A graph database adds no useful capability to this bounded, versioned policy. Language, infrastructure, systems concepts and cross-team competencies can offer partial evidence for another requirement without rewriting the candidate's claimed skills.

Each original work-evidenced/user-confirmed claim starts with credit 1; a listed mention starts with 0.6. Learning and negated claims start no traversal. Multiply edge weights along paths of at most two edges, discard credit below 0.025, and cap inferred credit at 0.8 at each step. Choose the strongest path, with deterministic source/edge ordering; never sum paths, inflate confidence through cycles, or start traversal from inferred profile claims. Explicit learning/negation blocks inference into or through that node.

For example, Redis → cloud infrastructure (0.25) → AWS (0.12) produces 0.03 credit. AWS remains yellow and its required gap remains visible. C++ offers stronger evidence for systems programming, and weaker evidence for threading. Cloud usage, latency, benchmarks, fault tolerance and availability provide different degrees of related systems evidence. A large team alone does not establish distributed systems expertise. Some vocabulary nodes remain intentionally disconnected until a justified relation is reviewed.

## Invariants

- Green means supported work/activity or user-confirmed coverage of the required facet, not independently verified proficiency.
- Yellow means listed/learning, ambiguous or related evidence. The UI labels paths and their evidence weight; this percentage is not a confidence probability.
- Purple means a possible unmentioned skill: a relevant one-edge question with zero credit.
- Red means absent/explicitly negated evidence, not proof that a candidate lacks ability.
- Exact supported evidence wins. Relations never override negation/learning, satisfy a required gap at partial credit, add years, or unlock employer context despite gaps.
- An alternative requirement contributes its strongest alternative once. Description highlighting evaluates each individual occurrence, so matching C++ does not turn an absent Java alternative green.
- Project the candidate once per ranking request. Each job uses map lookups; no graph traversal per job or database network request.
- Relations are separate from extraction. Responsibility/role mentions stay contextual; highlighting them does not make them requirements. The 5 October [qualification policy](QUALIFICATIONS.md) adds at most five relevance points from these skills without creating mandatory gaps. Company overview, benefits and legal/application context do not receive the benefit. Degree/year highlights use separate comparison metrics; inferred skills never establish their duration.
- Policy changes increment `relationsVersion` and therefore scoring/cursor identity. Vocabulary/extraction changes also invalidate public job features and require `pnpm features:backfill`.

## Description comparison and privacy

`POST /api/v1/jobs/:id/resume-match` accepts the same strict profile allowlist as ranking, including optional competency IDs/statuses, supported/denied/uncertain facets and interpretation. It performs transient comparison of a stored public description, with no private persistence and `no-store` responses. Its body limit is 256 KiB, with same-origin validation, generic private errors and 15 requests/minute per connection IP. Retained closed/stale/demo descriptions can be inspected, but the response explicitly labels whether the job passes recommendation availability checks.

Annotation offsets cover repeated recognized aliases in descriptions of at most 200,000 characters, capped at 2,000 occurrences. The UI renders the original sanitized employer layout as allowlisted React elements, splitting text nodes into semantic `mark` elements; it never injects candidate data into HTML. Canonical offsets align across emphasis and paragraphs, ignoring whitespace and heading-colon separators normalized by the job reader. Content mismatches fail closed to the original unhighlighted description. Overlaps use the earlier/longest occurrence. Unknown text remains readable. Reviewed comparisons always enable highlights without a checkbox, with contextual popovers accessible by hover, focus or tap. Color labels and screen-reader text convey status without relying solely on color. Editing or clearing the profile immediately makes the previous comparison unusable; superseded requests abort.

## Browser acceptance defaults, 5 October 2026

The browser matching allowlist accepts explicit positive listed claims by default after the overall profile review. Listed usage/general facets become accepted self-reports; development uncertainty, denied facets, learning, ambiguous/contextual statements and inferred interpretation retain their limits. Removing a chip excludes the claim. This is a browser review policy; raw analysis evidence is unchanged and no proficiency or activity-specific tenure is established. Skill/competency chips distinguish inferred activity with an icon and dashed border. Requirement explanations now appear on description highlights instead of a separate evidence panel.

## Implementation and verification

[Graph and projection](../backend/src/domain/matching/skill-relations.ts), [vocabulary](../backend/src/domain/resume/vocabulary.ts), [scoring](../backend/src/domain/matching/score.ts), [use case](../backend/src/application/resume/match-jobs.ts), [schemas](../backend/src/api/matching-schemas.ts), [comparison UI](../frontend/src/features/resume/JobProfileComparison.tsx), [evidence UI](../frontend/src/features/resume/MatchEvidence.tsx).

Synthetic tests cover edge validity, strongest paths, cycles/hop bounds, direct/negative/learning precedence, weak Redis/AWS evidence, preserved mandatory gaps, competencies, repeated offsets, alternatives and the independent 7-year industry / 2-year leadership thresholds. API tests cover privacy/validation and unchanged storage; application tests cover comparison availability and the existing bounded 25,000-feature scan. Frontend segmentation tests preserve literal markup/Unicode and reject invalid spans. Add new examples to the synthetic corpus, never real resumes. See [RESUME_TESTING](RESUME_TESTING.md) and [MATCHING](MATCHING.md).

## Limits and extension

[SEMANTICS.md](SEMANTICS.md) owns the implemented engineering registry, clause rules, scope distinction and green/yellow/purple/red review flow. [SEMANTIC_MATCHING_PLAN.md](SEMANTIC_MATCHING_PLAN.md) retains the remaining evaluation and role-expansion roadmap.

Relations are manually reviewed heuristics; tool familiarity does not prove systems-design competency. Ambiguous generic terms such as “performance” are not automatically classified as technical proficiency. Leadership-year thresholds remain uncertain until the profile supports reviewed activity intervals. Multi-language extraction, calibrated weights and richer temporal competency evidence require separate decisions and evaluation.
