# Proposal: explainable candidate-to-job matching

**Status:** Proposed; not implemented. Recorded 1 October 2026, Europe/Amsterdam. Product scope: [RESUME_PLAN.md](../RESUME_PLAN.md). Candidate evidence: [RESUME](RESUME.md).

## Decision and rationale

Extract versioned requirements from stored job descriptions and compare them with a reviewed candidate profile using deterministic strategies. Explain every contribution, requirement gap and unknown value. Ranking helps a candidate choose jobs to inspect; it does not estimate hiring probability or make a hiring decision.

Keep job enrichment separate from source adapters and candidate parsing. Reuse canonical skill IDs on both sides. Do not add an LLM, embeddings, vector database or a general-purpose recommendation framework to the first implementation.

## Job feature projection

Propose a public-data `JobFeatureProjection` with:

- Posting ID/content hash, requirements/vocabulary versions and enrichment generation.
- Skill groups with `required`, `preferred` or `contextual` importance; grouped alternatives such as Java **or** Kotlin; evidence excerpts and uncertainty.
- Overall/role-specific/skill-specific experience constraints with units and native wording.
- Role/function and seniority hints, explicit qualifications/certifications and equivalence clauses.
- Original/normalized locations, workplace mode, explicit country/region restrictions and known sponsorship statements.
- Extraction status, warnings and feature completeness.

Parse heading/sentence scope and negative/alternative phrases. A technology in a product description is contextual, not a mandatory qualification. Repeated requirements are one group with multiple evidence references. Conflicting ranges and unclear wording remain unresolved. Broad skills are not substitutes for specific ones unless a reviewed directional equivalence rule explicitly permits it.

Implement enrichment from persisted descriptions, keyed by posting hash and policy versions. A worker/backfill command computes new projections idempotently and publishes each atomically only if its input hash still matches the posting. Missing/outdated projections must not masquerade as current complete requirements. This projection is independent of source import success and does not change source lifecycle identity.

## Retrieval and availability

Add a focused query port backed by PostgreSQL indexes for status, company/function, canonical skills and reviewed geography. The existing [catalog](../backend/src/application/catalog.ts) loads snapshots into memory; do not reproduce that approach for every resume at full scale.

First filter by stored active status, current projection and source eligibility. Default source eligibility requires its latest completed run to have succeeded, complete enumeration, no removal quarantine, and observation within 36 hours. Label candidate-source matches partial/unconfirmed. Keep results from stale/failed/quarantined sources in a separate optional inventory view. Verified source status improves coverage evidence but still does not guarantee a vacancy remains open. Demo and closed postings are excluded from real matches.

Apply explicit user filters for company, function, destination and workplace. Only clearly incompatible facts/preferences exclude a job; unknown location/authorization stays unresolved. User-selected strict requirements must be shown as such. Never infer work authorization from name, nationality or address. A remote label without country scope does not establish worldwide eligibility.

For MVP, query compact features for all eligible jobs within the user's explicit filters in bounded chunks and rank the full set, with a documented maximum inventory benchmark of 50,000 postings. Do not silently select an arbitrary first 1,000 or drop jobs solely for having unknown skills. If execution exceeds its budget, return an explicit capacity response. More selective retrieval later requires measured recall and an advertised evaluated-candidate count, not an unqualified claim of global top matches.

Return eligible/evaluated/unenriched counts and dataset/feature versions so an empty list or limited inventory is understandable. Similar-looking listings retain separate identities; group only identical canonical posting links with explicit evidence, and preserve their source links. Cross-source title similarity alone cannot merge jobs.

## Fit policy

Use these initial dimensions, subject to corpus calibration:

| Dimension               | Weight | Evidence used                                                                                     |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| Skills                  | 50     | Required/preferred skill groups compared with explicit candidate claims and work/project evidence |
| Experience              | 20     | Relevant dated interval union compared with explicit overall/role/skill thresholds                |
| Function/role           | 15     | Candidate-confirmed target function plus evidenced role history versus job category/title         |
| Location/workplace      | 10     | Confirmed destinations, workplace preferences, relocation and explicit job restrictions           |
| Explicit qualifications | 5      | Stated certifications/education or accepted equivalent experience                                 |

Never infer seniority from graduation year, age or employer fame. More years than a stated minimum do not create an overqualification penalty. Soft-skill adjectives in the job do not prove the candidate has or lacks that competency.

Each dimension returns a fit value between 0 and 1 where assessable, an assessed fraction between 0 and 1, and an explanation. The proposed base formula is:

```text
baseFit = 100 * sum(weight[i] * assessedFraction[i] * fit[i])
                / sum(weight[i] * assessedFraction[i])
evidenceCompleteness = sum(weight[i] * assessedFraction[i]) / 100
```

When the denominator is zero, return no numeric fit. Unknown comparisons reduce evidence completeness rather than becoming failed requirements. Scores with less than 60% assessed evidence are shown as **needs review** in a separate group, not placed above well-supported recommendations because a small denominator produced 100. The 60% threshold is a proposed calibration starting point.

For skill evidence coverage, absence of a required skill from a reviewed resume means **not evidenced**, not "candidate lacks skill". It receives no positive coverage credit while retaining unknown ability status. Explain this distinction in the result. A candidate-confirmed absence is a known gap. A job with no reliably extracted skills has an unknown skills dimension rather than perfect coverage. Parser uncertainty must not be converted into an authoritative zero.

Within the skills dimension, required groups have relative weight 3 and preferred groups 1; contextual terms are displayed but carry no mandatory-skill points. Alternatives form one group evaluated by the best supported alternative, not multiple missing requirements. Work/project evidence or explicit user confirmation receives full presence credit; a plain skills-list claim receives 0.6 credit and a weaker evidence label. Learning-only/negated claims do not satisfy required groups. These credit values are proposed policy settings, not proficiency estimates. Duplicate mentions cannot accumulate credit.

Experience uses the correct kind of tenure for each requirement. For a known minimum, a confirmed relevant duration at/above it gets full credit and a known shorter duration gets proportional credit. If duration bounds straddle the minimum, eligibility remains unresolved; expose bounds and avoid a precise satisfaction claim. Evaluate alternatives/equivalencies together. Unknown skill-specific tenure never inherits all employment years.

Required qualifications and competencies remain individual explained checks even if combined into a dimension. Missing evidence does not silently become a hard exclusion. Clear incompatibilities are displayed separately and only filtered when the user has requested compatible-only results.

## Ordering and employer context

Order groups first by resolved constraints and sufficient evidence, then provisional fit band. Starting bands are strong (80–100), possible (60–79) and exploratory (below 60); these are UI labels pending evaluation, not guarantees. Put unresolved mandatory requirements in a visibly review-needed group. Within a group, sort by base fit plus an optional employer-context adjustment, then evidence completeness, freshness and stable posting ID. Keep integer display rounding separate from ordering precision.

Recognized employers appear in the profile even when weighting is disabled. Support the user's requested weighting as a transparent opt-in strategy, off by default:

- Versioned mappings specify employer alias/group, relevant target function/domain, adjustment, rationale and effective policy version.
- Maximum total adjustment is five points; multiple employers do not accumulate unlimited bonuses.
- Only supported, relevant direct-employment intervals qualify. Client/project exposure is separately labeled and does not silently receive direct-employment credit.
- A recognition mapping does not prove skill, seniority or mastery. Never add a bonus to candidate experience years or required-skill satisfaction.
- Unknown/unlisted employers have no negative multiplier; the baseline is the same for everyone.
- Apply the adjustment only within the pre-existing constraint/evidence group and base fit band. A 78 base fit plus five context points remains in the possible band.
- Always return `baseFit`, separate `employerContextAdjustment`, contributing mapping/evidence, and policy version. Changing the switch must produce an immediately explainable reranking.

Prefer mappings for relevant experience contexts, such as financial-market infrastructure or large-scale platform work, over an arbitrary global prestige list. A well-known company's name alone must not imply that a particular role had that context. Initial mapping values need manual review and held-out comparison with weighting off before release.

Example: candidate evidence shows TypeScript, PostgreSQL and three years of relevant backend experience. A job requires TypeScript, either PostgreSQL or MySQL, two years of backend work and onsite Amsterdam. The skills and duration can match; geography requires confirmation of Amsterdam/relocation. React mentioned elsewhere in the description is contextual unless actually required. Employment at a recognized company can produce a separately explained optional adjustment only after the base checks; it cannot resolve the location uncertainty.

## Explanations and public contract

Each match returns job identity/link, source coverage/freshness, base fit/band, evidence completeness, optional context adjustment, compatible/incompatible/unresolved checks, matched and not-evidenced requirement groups, candidate/job evidence excerpts and policy versions. Show the analysis date and experience range.

Do not generate explanations independently from the score: each matching strategy returns its contributions and evidence together. Contact details, raw file bytes and the full resume are never part of matching responses. Short, relevant candidate excerpts are still private and must not enter logs/analytics.

Pagination uses stable deterministic ordering and opaque signed cursors binding job dataset version, feature generation, profile/preferences fingerprint, fixed analysis date and policy versions. Return cursors in response bodies and accept them in POST bodies, never URLs. Profile edits, policy changes or job updates invalidate old cursors. Signing validates pagination integrity; it does not authenticate resume claims.

## Verification and integration

Proposed implementation follows the paths in [the plan](../RESUME_PLAN.md). Current integration points are [domain records](../backend/src/domain/model.ts), [job repository port](../backend/src/ports/ingestion.ts), [Prisma schema](../backend/prisma/schema.prisma), [API](../backend/src/api/app.ts) and [contracts](API.md). No matching models/migrations/routes exist yet.

Behavior tests must verify alternatives, unknowns, exact score contributions, chronology types, employer-context caps/bands, keyword repetition, negation, excluded closed/demo jobs and deterministic ties. PostgreSQL tests must verify idempotent projection updates, content-version races, current-feature joins, indexed query behavior and publication-consistent pagination. Evaluate ranking against human labels and report precision@10 by role and evidence completeness, with and without employer weighting. Avoid validating only a few handpicked examples or claiming scores predict hiring outcomes.
