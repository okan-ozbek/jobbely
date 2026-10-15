# Decision: reviewed vocabulary growth from the public catalog

**Status:** Implemented 8 October 2026, Europe/Amsterdam. This is a reviewed increment and repeatable discovery workflow, not complete language understanding or calibrated matching accuracy.

## Rationale and invariants

The [9 October baseline](MATCHING.md#qualification-baseline-9-october-2026) adds Espresso, XCUITest, software testing, testing pyramid and test quality (505 concepts), plus the `automated tests` alias. Espresso and bare testing require software context; coffee and medical-testing contrasts are rejected. These are recognition entries, not inferred proficiency or tenure. [Android Espresso](https://developer.android.com/training/testing/espresso), [Apple UI testing](https://developer.apple.com/documentation/xcuiautomation) and the [test pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) distinguish the named tools from testing methods. The platform follow-up below brings the registry to **526 concepts**. No relation edges are added. Current feature identity is `requirements-19:concepts-7:clauses-4:job-document-3`; the counts, review manifest and audit evidence below describe the 8 October increment.

### Platform and collaboration review, 9 October 2026

Reviewed the two user-reported public roles clause by clause. Added 15 capabilities: asynchronous task execution, API development, backend development, system reliability, system performance, system maintainability, data consistency, system latency, system correctness, software security, privacy engineering, software prototyping, advertising systems, marketplace systems and ML infrastructure. Added six competencies: cross-team collaboration, systems thinking, problem solving, customer empathy, initiative and clear communication. These represent explicit wording at a general level; adjectives do not establish specific reliability practices, quantified performance, leadership, expert proficiency or tenure.

Bare backend/reliability/performance/maintainability/consistency/latency/correctness/security/privacy/prototyping terms require nearby technical context; initiative requires ownership/proactivity context. Qualified aliases are explicit subject evidence. Contrast cases reject employee reliability, theatre performance, mall security, visitor privacy, medical testing and marketing initiatives. Explicit long-term maintainability is general engineering maintainability, not proof of a particular codebase or technique. Existing debugging, failover, architecture design and delivery ownership IDs gain bounded verb/plural/phrase aliases. No duplicate tool or implicit general-to-specific relationship is added.

The [Google SRE practices](https://sre.google/sre-book/part-III-practices/) and [introduction](https://sre.google/sre-book/introduction/) distinguish operational responsibilities and reliability concerns. [Microsoft's failover explanation](https://learn.microsoft.com/en-us/azure/reliability/concept-failover-failback) supports keeping failover distinct from generic reliability. These references inform terminology; they do not validate candidate matching. [Platform regressions](../backend/src/domain/matching/platform-baseline.test.ts) and the [matching owner](MATCHING.md#platform-qualification-follow-up-9-october-2026) record interpretation limits. Reanalyze transient candidate profiles after releasing the registry and replay public feature backfill.

Audit every current stored public description, including closed and unclassified postings. Identify named technologies, concrete capabilities and observable delivery activities. Reject company marketing, benefits, hiring instructions, generic adjectives and unspecified products. Frequency prioritizes review but cannot establish that a phrase is a skill; rare explicit technologies can still be accepted. Resume input never participates in this audit.

The shared registry now contains **500 concepts**, adding **252** to the existing 248. The [reviewed packs](../backend/src/domain/semantics/corpus.ts) cover application development, data/AI, cloud, hardware, security, business tools, product/design, sales/marketing and people/finance/operations. Stable IDs are preserved. [Recognition guards](../backend/src/domain/semantics/corpus-guards.ts) constrain homonyms to nearby subject context and stop at sentence boundaries. Longer qualified names suppress contained aliases: ASP.NET does not independently claim .NET; ONNX Runtime does not independently claim ONNX.

Tools, formats, practices and competencies remain distinct. Tools retain usage/development facets. Vendors do not establish their services. Responsibilities stay contextual rather than mandatory; learning, observation, negation and unresolved qualifications retain their existing semantics. No new transfer edges, automatic years, ranking formula or supported recommendation categories are introduced. The five supported recommendation functions remain those in [MATCHING](MATCHING.md), even though vocabulary discovery covers the entire catalog.

Feature identity is `requirements-15:concepts-4:clauses-4:job-document-1`. Registry/clause changes invalidate old projections and matching cursors. Run the [feature backfill](JOB_FEATURES.md) and release API/ingestion workers with the same vocabulary. Already reviewed private profiles should be reanalyzed. No public contract or database schema changes are needed.

## Attached ingestion-role terms

| Wording                                 | Interpretation                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Working/collaborating with stakeholders | Existing stakeholder communication competency, recognized as a bounded activity rather than a bare stakeholder noun |
| S3                                      | Existing Amazon S3 ID gains shorthand recognition in storage/cloud context                                          |
| GCS                                     | Google Cloud Storage in cloud/data context; contractors are not equivalent                                          |
| Iceberg                                 | Apache Iceberg in table/data context; metaphorical wording is excluded                                              |
| Other datastores                        | Connector wording can establish data integration; no named database is invented                                     |
| Clear APIs                              | Bounded design/build/provision wording can establish API design; using an API alone cannot                          |
| Safe defaults                           | A software/configuration practice, not proof of security expertise                                                  |
| Automated provisioning                  | Provisioning capability, not automatic Terraform proficiency                                                        |
| Documentation                           | Technical/API documentation in software context; legal paperwork is not equivalent                                  |
| Dead-letter queues                      | A distinct queue failure-handling capability, not automatic SQS/RabbitMQ proficiency                                |

These responsibility statements add contextual relevance. Their absence from a resume does not create mandatory gaps unless separately required by the employer.

Service meanings were checked against primary [Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html), [Google Cloud Storage](https://docs.cloud.google.com/storage/docs/introduction), [Apache Iceberg](https://iceberg.apache.org/docs/latest/) and [dead-letter queue](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html) documentation. These identify technologies, not candidate expertise.

## Repeatable discovery

```powershell
pnpm vocabulary:audit
```

Requires `DATA_MODE=postgres` and normal `DATABASE_URL`. The [operator CLI](../backend/src/cli/audit-vocabulary.ts) writes `backend/data/vocabulary-audit.json`, ignored by Git. It prints aggregate counts/path only. There is no public endpoint or automatic registry mutation.

The [PostgreSQL reader](../backend/src/infrastructure/audits/vocabulary.ts) performs two read-only passes in one repeatable-read transaction, fetching 250 current descriptions at a time. It never reads account, candidate, raw provider or posting-history tables. Pass one retains compact per-posting phrase frequencies. Pass two collects at most three public examples and employer/category counts for the 10,000 most frequent candidates occurring in at least three postings. Final ordering favors employer breadth, then posting frequency. Each posting counts once per term. Removing recognized skills leaves separators so neighboring words cannot become invented phrases.

[Pure discovery](../backend/src/domain/semantics/vocabulary-audit.ts) excludes recognized information sections. Remaining qualification blocks and English skill/action cues propose unknown one-to-three-token phrases. All descriptions are counted, with explicit empty/truncated descriptions, excluded blocks, blocks without discovery cues, unique unknown terms, recurring candidates and candidate-list truncation. At two million unique phrases it fails explicitly rather than reporting a partial scan as complete. Only selected candidates retain examples. The operator scan never runs during resume analysis or recommendations.

Future batches: inspect examples across employers/functions, establish meanings and ambiguity boundaries, reuse IDs for synonyms, add contrasting tests, update registry/clause versions, and backfill features. Keep private resumes and raw audit exports out of fixtures, logs and commits. Do not promote unknown products or generic wording merely to raise assessment coverage.

## Limits and remaining review

The snapshot scan covers the whole catalog; additions are a reviewed batch rather than individually understanding every word. Mention counts do not measure precision, recall, proficiency or hiring probability. English heuristics/heading recovery can miss terms and misclassify unknown company prose. Non-English interpretation, proprietary products, compound activities and held-out ranking calibration remain unfinished.

Ambiguous `SEM` (marketing/electron microscopy), `SSE` (CPU/security/server-sent events), `HIP` and bare `Triton` require separate contextual review. [Triton language](https://triton-lang.org/main/index.html) and [NVIDIA Triton Inference Server](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/index.html) are different products and must not share an unconditional alias. Generic Oracle ERP wording cannot establish Oracle Database expertise. Unsupported qualifications remain reviewable; no automatic fit is awarded for them.

## Verification

[Vocabulary contrasts](../backend/src/domain/semantics/corpus.test.ts) cover the attached concepts, homonyms, sentence scope, offsets, shared resume/job recognition, mandatory gaps, alternatives, unknown requirements and audit accounting. [Semantic regressions](../backend/src/domain/semantics/semantic-matching.test.ts) retain polarity, facets and relation behavior. [PostgreSQL tests](../backend/src/infrastructure/storage/postgres.test.ts) verify complete read-only audit counts/unchanged revisions alongside existing publication/race protections. [Coverage](../backend/src/domain/matching/assessment-coverage.test.ts) and [pagination](../backend/src/application/resume/match-jobs.test.ts) use fictional uncatalogued terms for unknown-requirement cases now that VHDL is recognized.

### Local evidence, 8 October 2026

The consistent public snapshot at dataset revision 578 / feature generation 294 contained **16,994 current descriptions from 57 companies**, including closed and unclassified postings. Two passes completed with zero empty or oversized descriptions. All 252 additions had recognized mentions; at least one addition appeared in 13,857 descriptions. These are reach counts, not matching accuracy. The [review manifest](VOCABULARY_REVIEW.json) records each addition, family, mention count and example employers without raw description excerpts or candidate data.

Discovery produced 694,237 unique unknown phrases and 148,128 recurring candidates. The bounded report retained 10,000 candidates, explicitly marking list truncation; 140,129 body blocks lacked English discovery cues. These remaining phrases include prose and hiring language, not 148,128 missing skills. The scan processed every description, but did not individually classify every word or review every candidate. Raw public exports remain ignored local operator data.

Final `pnpm check` passed: formatting, boundaries, 81 logo assets, root lint with zero warnings, strict types, 812 backend tests, 39 frontend tests, generated contracts and production builds. The default run skipped 39 PostgreSQL-dependent tests; the affected storage suite separately passed all 13 tests against an isolated `jobbely_test_*` database. No public schema changes were required.

The final Docker API image and ingestion worker use `concepts-4:clauses-4`. Backfill inspected and updated **17,140** postings after ingestion grew beyond the audit snapshot. A database count verified matching content hashes and current feature versions for all 17,140 rows at that observation. The worker was then restored. This count is dated evidence, not a guarantee about later ingestion.

The running public API recognizes all ten reviewed concepts in the attached Reddit ingestion role (posting `a6c4182c-1238-4023-8b35-f1cd873b8981`), including coordinated engineers/stakeholders wording. A fictional resume returned work evidence for the new skills, a negated Terraform claim and a learning TensorRT claim. A separate manually confirmed fictional profile produced green direct annotations for those concepts. Nothing was inferred from a private candidate document.

Two synthetic recommendation requests evaluated all 2,440 eligible engineering features with zero unenriched rows. Each returned ten items in comparator order; the second page had no overlap and preserved order across the page boundary. Local response times were approximately 4.9 and 4.4 seconds, including HTTP/database work. Ranking remains band-first, then coverage-adjusted score with existing tie-breakers; this is neither a production load benchmark nor calibrated relevance. Vocabulary expansion does not certify overall product viability, complete interpretation or hiring probability.
