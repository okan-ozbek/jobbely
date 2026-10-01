# Proposal: structured requirements and optional local semantic extraction

**Status:** Proposed, 2 October 2026, Europe/Amsterdam. Diagnosis reproduced against current code; no model installed, no inference service added, and no scoring or extraction behavior changed by this document. The implemented deterministic baseline remains [SEMANTICS](SEMANTICS.md).

## Recommendation and scope

Build a structure-aware, evidence-backed comparison pipeline, then evaluate an optional local language model as an extraction strategy. A larger alias list cannot solve section loss, mixed obligations, unknown vocabulary and paraphrase coverage together. An LLM can propose structured interpretations of full sentences; TypeScript must validate those interpretations and retain control of requirement logic, dates, colors, gaps and ranking.

Keep public listing collection and employer/category mapping AI-free. AI-assisted requirement enrichment and private resume interpretation would be a separately identified, optional product mode. This extends the original zero-AI matching boundary only if the experimental strategy passes its evaluation gates. The rules-only mode must remain usable.

Do not tune toward a predetermined higher score for one candidate. Correct extraction may raise a genuine backend match and lower a specialized AI/animation match. Keyword overlap, semantic relevance, requirement satisfaction, extraction coverage and eligibility are different measurements.

## Confirmed baseline failures

The following public/synthetic examples were reproduced on 2 October. No real candidate text, contact details or document bytes belong in this document or the test corpus.

| Case                                                                         | Current behavior                                                                                                                            | Required correction                                                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A bold Qualifications label immediately followed by 3–5 years                | HTML preparation flattens the label and body into Qualifications3-5; the exact-heading parser leaves the experience contextual and omits it | Preserve structural boundaries; retain a 36–60 month target range, with 36 months as its minimum                   |
| 3–5 years of engineering experience, preferably supporting animation studios | Importance is sentence-wide; preferably is not recognized as the existing preferred cue                                                     | Separate the required engineering duration from the preferred animation-domain experience                          |
| Databricks heading What we look for                                          | Not a recognized heading; Experience developing large-scale distributed systems has no recognized requirement cue                           | Recognize candidate sections and obligations without requiring one fixed verb or heading                           |
| Production experience in one of Java, Scala, C++, or a similar language      | Scala is not recognized; Java and C++ become independent required groups                                                                    | Parse the complete alternative structure, including unsupported members and the open-ended similar-language clause |
| High-throughput systems                                                      | The existing throughput concept recognizes throughput optimization, not this requirement                                                    | Separate a high-throughput systems capability from an optimization activity; recognize relevant variants           |
| GenAI-native; inference and training technologies                            | GenAI is absent from the registry; scalable can be recognized while the central technical scope is lost                                     | Recognize the capability and scope; retain responsibility versus qualification semantics                           |
| Skills needed to excel in your career                                        | Ordinary verb excel becomes the Excel product                                                                                               | Require technical/product context for ambiguous aliases; preserve legitimate spreadsheet requirements              |
| Interview accommodation during hiring; contact your recruiting partner       | Hiring/recruiting are extracted and receive candidate-match colors                                                                          | Mark the passage as application-process information; exclude it from skill gaps, prompts and match colors          |
| Wrapped resume phrases and clauses                                           | Recognition runs on each physical line; a phrase split over lines loses work evidence                                                       | Reconstruct logical bullets/paragraphs while retaining a map to original reading blocks                            |
| AWS parenthesized S3/ECS/ElastiCache list                                    | Canonical aliases often require the AWS prefix on each service; bare scoped service names are lost                                          | Resolve services within the cloud/vendor list, without asserting every AWS service from AWS alone                  |
| SaaS/SOA, event-sourced workflows, operational outcomes                      | Vocabulary and action rules omit important backend capabilities; ordinary-word guards can reject legitimate programming-language use        | Add contextual canonicalization and action/object/outcome evidence with positive and negative contrasts            |
| Header location next to contact fields                                       | The location parser expects a whole location line; a delimited contact line can produce unknown                                             | Parse the location segment separately, without forwarding contact fields to matching                               |

Two confirmed API observations illustrate why a higher percentage alone is the wrong goal. The public Netflix Software Engineer 3 – Ink posting returned a base score of 100 with one recognized required skill and no extracted experience comparison. The stored Amsterdam Databricks Software Engineer – Backend posting returned 90 while treating Java and C++ as independent requirements. These are limited current comparisons, not calibrated ATS scores. The existing ranking domain can mark such cases as review, but the single-job response omits completeness and band, leaving the comparison without those safeguards in its presentation.

## Document structure before semantic extraction

Introduce a bounded structured document representation: block ID, kind, heading ancestry, section role, raw text and source spans. Job HTML parsing happens in infrastructure; domain policies operate on that representation. Preserve headings expressed as heading tags, standalone bold labels, list items and inline labels. Plain-text providers need a separate heading/boundary strategy. Do not blindly split every bold span: employers also emphasize ordinary terms inside sentences.

Resume logical blocks should join continuation lines within one bullet/paragraph, respecting page/column bands, role boundaries, new bullets and headings. Keep original lines and document reading order visible. Normalization must map spans back to the original representation; it must not merge unrelated columns, employers or skills lists. Recognize project headings so project evidence is distinguishable from employment evidence. Candidate role dates still do not establish every activity's duration.

For jobs, retain internal section roles beyond three display buckets: company overview, role summary, responsibilities, candidate qualifications, benefits, compensation, application process, legal/compliance and unknown. Section role guides interpretation; it cannot override an explicit qualification buried in a responsibility paragraph. Conditional eligibility/compliance clauses remain separately reviewable rather than disappearing as generic footer text.

## Three user-facing groups

1. **Required qualifications:** explicit candidate obligations, minimums, mandatory experience and unresolved required statements.
2. **Preferred qualifications / nice to haves:** preferred skills, bonus qualifications and preferred domains. Nice to haves belong here, rather than being treated as mandatory.
3. **Additional information:** responsibilities, team/stack context, employer overview, benefits, compensation, application instructions and legal information, organized under their original headings.

Use a separate eligibility area for location, work authorization and qualifications requiring candidate review. Application accommodations are information, not skill requirements. Preserve the complete original description as the source of truth. A role description may discuss GenAI-native production without demanding prior GenAI expertise; a foundational inference/training qualification is a candidate requirement. Display that distinction.

Full match colors should apply to actual qualification evidence. Exclude overview/benefit/application text from match coloring by default; a separately labeled role-context view can show related evidence without adding required gaps or credit. Display unknown and unresolved qualification counts beside matched/missing counts. Zero recognized gaps must not imply all qualifications were understood.

## Requirement and candidate evidence model

Represent meaning rather than just a bag of concept IDs:

- Requirement: stable ID, required/preferred importance, candidate/role/information scope, action, object, domain, tools, proficiency cue, modality, negation, evidence block/span and extraction provenance.
- Logic: all-of, any-of and conditional groups; unknown/open-ended alternatives remain represented and reviewable. A language alternative contributes once. Related concepts emitted from one clause do not count as several independent obligations.
- Duration: minimum and optional target maximum, professional/function/activity scope, associated capability or alternative group, and an exact source span. A 3–5 year range is not an automatic penalty for more than five years. Separate engineering and leadership thresholds remain separate.
- Candidate evidence: performed/assisted/observed/learning/negated/reviewed, action/object/outcome/tool/domain, source block, role/project association and reviewed dates where available. Skills lists remain self-reported evidence, distinguishable from performed activities.
- Canonicalization: known concept IDs plus bounded unresolved labels. Preserve unsupported terms and their clauses; an unknown word must not split an OR list or vanish from coverage. Canonical definitions distinguish usage, internals, operational reliability, high throughput, machine-learning inference and model training.

For example, a synthetic statement about bounded retries and failure isolation supports service resilience. It does not automatically prove consensus-protocol expertise. Using a caching product is different from designing a distributed storage engine. Related tools can suggest a question without asserting an unmentioned competency. Similarity alone cannot turn either example green.

Every comparison should point from a requirement span to candidate evidence spans or an explicit reviewed claim. Green means supported coverage of that requirement scope; yellow means relevant but incomplete/uncertain evidence; purple is a zero-credit confirmation question; red means no supported evidence or denial. Employer brand, repeated synonyms and model self-confidence cannot manufacture credit or activity-specific years.

## Local model strategy and architecture

Add a small semantic extraction port with a rules implementation and an optional local-model adapter. Application use cases choose the configured strategy; bootstrap owns wiring. Model HTTP calls, runtime settings and payloads stay in infrastructure. Domain validation, requirement algebra, evidence decisions and scoring stay pure. Reuse generated contracts, document sessions and public feature publication rather than introducing an agent framework or graph database.

The local model should classify blocks and extract sentence propositions, obligation clauses, alternatives and evidence references. Give it the sentence plus heading and bounded neighboring blocks, not a context-free keyword. Do not ask it to invent a percentage or write a free-form judgment of the candidate. Unknown must be an allowed result.

[Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs) accept a JSON schema and can support this adapter. Schema conformance is not semantic correctness: validate canonical IDs, source references, exact supporting quotes/spans, logic, numeric values, polarity and resource bounds in TypeScript. A verbatim supporting quote establishes provenance, not entailment; independently evaluated evidence checks are still needed before semantic claims receive full credit.

Benchmark small and medium instruction models on the same labeled corpus, including candidate 4B/8B-class Qwen models. The [Qwen3 release](https://qwenlm.github.io/blog/qwen3/) documents local deployment options. These are evaluation candidates, not a claim that a model is best or compatible with the user's hardware. Choose the exact model, digest, quantization and context budget only after measured accuracy, latency, RAM/VRAM and license review. Do not select a model from generic leaderboard scores alone.

Sentence embeddings can retrieve plausible evidence blocks; a pairwise reranker can prioritize them. [Qwen's embedding/reranker reference](https://qwenlm.github.io/blog/qwen3-embedding/) describes separate retrieval and pair-scoring models. Neither similarity nor a reranker relevance score establishes qualification satisfaction, negation, tenure or eligibility. Start with extraction; introduce retrieval only when measured capacity requires it.

The proposed flow is: structured blocks → rules and optional model extraction → source/semantic validation → candidate review → deterministic requirement comparison → explained results. Inspectable intermediate states identify whether a failure came from reading order, section classification, interpretation, canonicalization or scoring.

## Privacy, deployment and resource boundaries

Start the model experiment on public job descriptions and synthetic profiles. Public enrichment can be processed once per posting revision and persisted as a versioned projection. Resume-assisted extraction requires an explicit product choice and privacy disclosure before it is enabled; it remains transient with no private queue, embeddings store, disk cache, transcript or request-body logging. Contact fields should be excluded before model input, not merely stripped from its output.

Local must identify where inference runs. An Ollama sidecar on the Jobbely backend is local to that host, not necessarily the candidate's device. Browser PDF parsing remains unchanged and isolated; do not grant its worker network access. A device-local model connector would be a different deployment and security design. No cloud model or silent remote fallback may be substituted.

The [Ollama FAQ](https://docs.ollama.com/faq) documents local-only mode and disabling cloud features. A future deployment should restrict access to the adapter, disable cloud routes, pin downloaded weights, bound context/output/concurrency, and apply timeouts/cancellation. Local deployment does not by itself prove the absence of payload logs, disk spill or runtime telemetry; verify the actual configuration.

Candidate content and employer descriptions are untrusted input, never instructions. The extractor has no tools, browsing, filesystem or application-action permissions. Test embedded instructions and forged evidence references. Reject invalid/unsupported outputs or preserve them as unresolved; do not retry indefinitely. Model outage or rejected output falls back to visibly incomplete rules extraction, never a fabricated confident result.

## Versions, projections and API implications

Public feature identity must include content hash, structured-document version, extractor strategy, model digest/quantization where applicable, prompt/schema version, ontology version and validation policy. A model/prompt/strategy change invalidates affected features just as a rules change does. Preserve the compare-and-publish locking/hash checks in [JOB_FEATURES](JOB_FEATURES.md); expensive inference must occur outside the publication transaction.

Do not run generative inference for every profile against every job. Enrich jobs on ingestion/backfill; interpret a resume once per revision; compare validated structured features. Isolate and report pending or failed enrichment. Measure a full-corpus backfill before enabling scheduling.

Expose strategy/provenance, qualification groups, unknown counts, completeness and review state in the API/UI. Changes to reviewed evidence must invalidate previous results and cursors. A future optional evidence-comparison model belongs in a bounded experiment, not an unversioned call inside the ranking loop. Regenerate contracts and test profile allowlists whenever the public evidence model changes.

## Testable delivery sequence

| Stage                                | Deliverable                                                                                                                                             | Gate before proceeding                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Structure and diagnostic UI       | Preserve job sections; reconstruct logical resume blocks; show required/preferred/additional and unknown counts                                         | Equivalent HTML/plain text/PDF line wrapping preserves the same sections, concepts, original offsets and dates; policy/application text produces zero skill colors or gaps              |
| 2. Deterministic correctness         | Context guards, mixed required/preferred clauses, complete OR lists, scoped service aliases, SaaS/SOA/high-throughput/GenAI vocabulary, duration ranges | Synthetic regressions for every confirmed failure; unsupported OR alternatives survive; language skill credit never invents two years using it                                          |
| 3. Shared evidence contracts         | Structured clauses, role/project scope, requirement logic and reviewable provenance                                                                     | API round trips retain semantics; contact/excerpt allowlists, edits/cursors and public projection races remain correct; contracts regenerated                                           |
| 4. Public-job local-model experiment | Optional adapter plus rules/model shadow comparison; no score changes                                                                                   | Independently labeled job sections/clauses beat the rules baseline on recall while retaining precision and explicit abstention; invalid quotes/IDs and prompt injection rejected        |
| 5. Synthetic profile experiment      | Sentence propositions and reviewed semantic evidence; no private persistence                                                                            | Performed/assisted/observed/learning/negated contrasts, relevant domains and tool facets are distinguished; paraphrases match and misleadingly similar sentences do not                 |
| 6. Optional candidate flow           | Disclosed transient model interpretation followed by candidate review                                                                                   | Private data absent from all storage/log/cache paths; cancellation, timeout, unavailable model and rules fallback verified; desktop/mobile/keyboard review works                        |
| 7. Ranking calibration and rollout   | Explained qualification coverage, separate preferred/domain evidence and eligibility review                                                             | Held-out profile/job ordering and gap explanations improve; sparse extraction cannot present a misleading complete fit; full-dataset latency/memory/backfill and PostgreSQL checks pass |

Stages 1–3 improve the product independently of an LLM. Stages 4–5 decide whether the extra dependency is justified. Enable stages 6–7 only after results support it. This plan does not promise that an LLM understands every sentence or removes manual review.

## Evaluation and acceptance

Create a separately labeled, frozen held-out set using public employer job paragraphs and synthetic candidates. Split by employer/template and paraphrase family to reduce leakage from the development cases; review disagreements before measuring. Include engineering backend, animation/ML, quantitative systems and people roles so keyword disambiguation is evaluated across domains. Do not copy the attached candidate resume into a fixture or benchmark artifact.

Measure each stage separately: block/section accuracy, required/preferred/context precision and recall, unknown-clause coverage, alternative and duration accuracy, source-span validity, evidence entailment/contradiction/abstention, suggestion usefulness, ranking quality and user corrections. Report per-slice counts and uncertainty, not just one overall percentage. Temperature zero and model-reported confidence do not establish calibration or exact reproducibility.

Proposed launch targets, to be confirmed with sufficient sample sizes: at least 95% precision for required-clause extraction and green semantic coverage, at least 90% required-clause recall, and at least 95% correct alternative/duration interpretation. Require no application/benefit clauses scored as candidate requirements in the adversarial regression set and no invented tenure or unsupported green decisions in critical negative tests. Report observed errors and intervals; these targets have not been achieved by the current implementation or any model experiment.

Keep manual acceptance tests for: ordinary excel versus Excel spreadsheets; engineer responsible for hiring versus applicant contacting a recruiter; production high throughput versus a team aspiration; training an ML model versus onboarding employees; direct inference-serving work versus an employer using AI; project implementation versus two years of professional production language experience. Check the three UI groups against the original text, not just extracted tags.

## Implementation references and verification performed

- [HTML preparation](../backend/src/infrastructure/html.ts), [PDF reading lines](../frontend/src/features/resume/documents/pdf.ts), [resume sections](../backend/src/domain/resume/document.ts).
- [Requirements](../backend/src/domain/matching/requirements.ts), [recognition](../backend/src/domain/semantics/recognize.ts), [clauses](../backend/src/domain/semantics/clauses.ts), [resume signals](../backend/src/domain/resume/vocabulary.ts), [location](../backend/src/domain/resume/employment.ts).
- [Scoring](../backend/src/domain/matching/score.ts), [single-job comparison](../backend/src/application/resume/match-jobs.ts), [response schemas](../backend/src/api/matching-schemas.ts), [comparison UI](../frontend/src/features/resume/JobProfileComparison.tsx).
- [Current privacy](RESUME_PRIVACY.md), [documents](DOCUMENTS.md), [projection races](JOB_FEATURES.md), [quality](QUALITY.md), [synthetic review guide](RESUME_TESTING.md).

This proposal is grounded in read-only PDF layout/extraction inspection using the application's PDF adapter, current source review, synthetic HTML/clause probes and two live local comparison API requests. Source references for the proposed runtime/model capabilities were checked on 2 October 2026. No LLM inference, accuracy benchmark, application code changes or new automated application test suite was performed for this proposal. Documentation formatting and local link checks are separate completion checks.
