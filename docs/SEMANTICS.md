# Decision: deterministic engineering clauses and scoped skill review

**Status:** Initial engineering increment implemented, 2 October 2026, Europe/Amsterdam. Independent held-out calibration and expanded role-specific language packs remain proposed.

## Structured evidence update, 2 October 2026

[STRUCTURED_MATCHING](STRUCTURED_MATCHING.md) records the implemented job sections, logical resume blocks, required/preferred/additional groups and bounded source-reference contracts. Analysis is text-3; public features are requirements-13:concepts-2:clauses-2:job-document-1, scoring score-4:relations-3. Single-job comparison exposes completeness, review band and unresolved counts. Matching forwards only allowlisted evidence metadata; resume excerpts remain transient. Earlier dated verification below describes its own increment.

## Decision and rationale

Share a pure TypeScript concept registry and clause recognizer between resumes and job descriptions. The registry has 239 canonical concepts with stable IDs, aliases, kinds, families, definitions, supported facets and local provenance. Existing IDs are preserved. Reviewed engineering packs add compiler tools, memory/concurrency, distributed mechanisms, cloud services, backend practices and distinct delivery competencies. This introduces no runtime AI or external taxonomy service.

Exact aliases and 16 reviewed activity rules emit a concept, facet, interpretation, rule and UTF-16 span. Safe punctuation normalization preserves offsets; resume offsets reference the returned document with normalized line endings. Longer aliases suppress contained component names: clang-tidy does not become a direct Clang claim, and LLVM IR does not assert LLVM tool experience. Ordinary Go/React/Rust/Spark and generic low-level phrases retain context guards.

Activities include automatic failover, keeping services running through node failures, reducing request latency, profiling contention, cross-team delivery, technical direction, mentoring, compiler passes, frontend development, concurrent requests, SQL query work and gradual rollouts. These are bounded English patterns, not general natural-language understanding. Unrecognized fragments remain visible for review.

Negation extends across coordinated lists and stops at statement/contrast boundaries. Learning, observation, assistance, plans and employer-context clauses cannot establish full coverage or seed skill-discovery questions. Strong work evidence survives repetition in a skills list; a different uncertain scope does not become confirmed from it. Explicit conflicting negative evidence remains conservative. No clause or graph establishes years using a skill.

## Coverage and review invariants

| Decision    | Presentation | Meaning and credit                                                                                                 |
| ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `full`      | Green        | Supported work/activity or candidate confirmation for the required scope; credit 1, not an independent attestation |
| `partial`   | Yellow       | Listed, related, learning or uncertain evidence; below full credit, possibly zero                                  |
| `suggested` | Purple       | A relevant skill may be unmentioned; always zero credit until answered and reviewed                                |
| `none`      | Red          | No supported evidence or an explicit denial; not proof of inability                                                |

Compiler **usage** and **development of internals** are separate facets. C++ can produce a one-edge Clang/LLVM question, never established expertise. Confirmed Clang usage covers a usage requirement; development remains partial and can ask its own scoped question. Denied/unsure answers suppress repetition for that scope. Development evidence can cover usage; usage cannot fully cover development. Confirmation is a self-report and never adds tenure.

The directed adjacency list records transferable, specialization, possible-tool and ecosystem relations, with separate partial/suggestion modes. Partial paths keep the existing two-hop, strongest-path, 0.025 floor and 0.8 cap. Suggestions use only original full evidence, one reviewed edge, no aggregation/chaining and zero edge credit. Only required/preferred comparisons create prompts, with at most five unique concept/facet questions shown for the open job. Existing starter coverage for other functions is retained; its broader semantic expansion is not claimed.

Scoped answers are bounded corrections (`signalReviews`, at most 100 unique concept/facet answers). Matching receives only IDs, statuses, facets and interpretation plus the existing employment/location allowlist. Raw excerpts, contact fields and document text stay out of matching requests. Candidate material and answers remain in tab/request memory. Changes immediately invalidate review, abort stale requests and clear result pagination. The candidate explicitly reviews the revised profile before returning to the job comparison or ranking. Removing a claim also removes its scoped answers.

## Requirement logic and versions

Required/preferred/contextual policies remain separate from recognition. Employer stack statements are contextual, even under a required heading. OR alternatives contribute once. Multiple concepts emitted by one interpreted activity contribute one requirement; evidence paths never accumulate credit. Alternative degree/experience routes remain unresolved for manual review rather than becoming cumulative mandatory thresholds. Separate year clauses in a single sentence retain separate activity scopes, including seven years building systems and two years managing engineers. Leadership/skill tenure remains unresolved without reviewed activity intervals.

Public features carry optional evidence spans, scoped alternatives and interpretation. They contain only public employer text. Registry/clause versions feed the vocabulary/feature version; relation versions feed scoring/cursor identity. Policy changes require contract generation and replayable public-feature backfill. No storage migration or candidate persistence is needed. See [JOB_FEATURES](JOB_FEATURES.md), [MATCHING](MATCHING.md) and [RESUME_PRIVACY](RESUME_PRIVACY.md).

## Implementation and verification

- [Registry](../backend/src/domain/semantics/concepts.ts), [engineering packs](../backend/src/domain/semantics/engineering.ts), [clauses](../backend/src/domain/semantics/clauses.ts), [recognition](../backend/src/domain/semantics/recognize.ts).
- [Resume evidence](../backend/src/domain/resume/vocabulary.ts), [correction replay](../backend/src/application/resume/analyze-resume.ts), [requirements](../backend/src/domain/matching/requirements.ts), [relations](../backend/src/domain/matching/skill-relations.ts), [score](../backend/src/domain/matching/score.ts).
- [Shared API semantics](../backend/src/api/semantic-schemas.ts), [questions](../frontend/src/features/resume/SkillQuestions.tsx), [review helpers](../frontend/src/features/resume/semantic-review.ts), [private profile allowlist](../frontend/src/features/resume/match-profile.ts).
- [176 synthetic clause contrasts and 30 profile/job pairs](../backend/src/domain/semantics/semantic-matching.test.ts), [fixture activities](../backend/src/test-fixtures/semantic-clauses.ts), [API serialization/privacy](../backend/src/api/matching.test.ts), [question limits/allowlist tests](../frontend/src/features/resume/semantic-review.test.ts).

The corpus is a labeled development regression set with systematic polarity/context variants. It is **not** independent held-out evidence of 95% precision or general accuracy. The existing bounded scan now exercises 25,000 synthetic jobs with 40 requirements and a 200-claim profile. Production concurrency, p95 latency, memory profiling, suggestion usefulness and independently labeled ranking quality still need evaluation.

The usage/development boundary is informed by [Clang's official frontend/tooling overview](https://clang.llvm.org/) and [LLVM's pass-development documentation](https://llvm.org/docs/WritingAnLLVMPass.html), checked 2 October 2026. These explain technology structure, not candidate proficiency or calibrated edge weights. No ESCO/O*NET data is imported in this increment.

See [RESUME_TESTING](RESUME_TESTING.md) for commands and manual checks, and [SEMANTIC_MATCHING_PLAN](SEMANTIC_MATCHING_PLAN.md) for the remaining roadmap. Rules, aliases and relationships need new contrasting examples and version changes when extended.
