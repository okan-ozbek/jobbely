# Decision: isolated semantic matching experiments

**Status:** Development evaluation, requirement algebra, evidence contracts and public-job shadow adapter implemented, 4 October 2026, Europe/Amsterdam. Live recommendations remain deterministic. Actual model inference, independently reviewed evaluation, candidate semantic analysis, retrieval and production rollout remain pending.

## Rationale and layers

Implement the foundations of [RESUME_MATCHING_REWORK](RESUME_MATCHING_REWORK.md) before enabling uncalibrated model recommendations. Existing uncommitted work was preserved on `codex/semantic-resume-matching`.

[Semantic contracts](../backend/src/domain/matching/semantic-model.ts) retain open-vocabulary action/object/domain/scope descriptors, tools, canonical IDs, explicit duration scope, polarity and exact source quotes. Candidate proposition contracts preserve activities separately from aggregate skills; they are not yet part of the public API and no candidate model inference is enabled.

[Pure requirement algebra](../backend/src/domain/matching/requirement-logic.ts) evaluates nested all-of, any-of and conditional expressions. Full evidence receives 1, partial evidence 0.5, missing/denied/suggested evidence 0 and unknown evidence a 0–1 interval. All-of takes its weakest constituent; any-of takes its strongest route. Conditions become inapplicable only when explicitly contradicted. Missing condition evidence remains unknown. Contradictory assessments cannot be overwritten by a supported assessment.

Required and preferred percentages use all applicable obligations as their denominator. Unknowns stay in lower/upper ranges. Incomplete interpretation, no obligations or entirely inapplicable conditions suppress percentages. This policy is experimental, not a calibrated probability, and does not yet replace live `scoreJob`.

[The extractor port](../backend/src/ports/semantic-extractor.ts) accepts public-job inputs. [Rules](../backend/src/infrastructure/semantics/rules.ts) and [Ollama](../backend/src/infrastructure/semantics/ollama.ts) implement it. [Experiment bootstrap](../backend/src/bootstrap-semantics.ts) wires the local adapter only when an operator invokes it; normal API/worker startup does not contact a model.

[The shadow use case](../backend/src/application/resume/semantic-shadow.ts) has no repository publication, scoring or candidate input. [Evaluation](../backend/src/application/resume/evaluate-semantics.ts) runs the same labeled samples through each strategy and retains failures in recall denominators.

## Source and numeric validation

Outputs have a strict bounded schema. [Validation](../backend/src/domain/matching/semantic-validation.ts) checks exact quotations and block-relative UTF-16 offsets, referenced IDs, ontology IDs, expression depth, atom/source containment, complete block disposition accounting and stated numeric durations. Every atom must be used and every obligation attributed. Unfamiliar capabilities may have empty canonical-ID lists; vocabulary membership is not required for their recognition.

A valid quote establishes provenance, not semantic correctness. Wrong-domain interpretations can pass structural validation and require independent semantic labels. Numeric checks verify a stated minimum; they cannot establish that the model attached it to the correct activity. Explicit review remains necessary before using model evidence for scores or tenure.

## Development evaluation

Run from the repository root:

```powershell
pnpm matching:evaluate
```

Output includes corpus/policy identity, per-case errors, localization precision/recall, expression/duration diagnostics, unknown counts and the original resume paraphrase/sparse-score probes. It accepts no arbitrary resume/file inputs.

[The 18 fictional development cases](../backend/src/test-fixtures/semantic-evaluation.ts) cover all five functions, paraphrases, employer context, benefits/application text, language alternatives, conjunctions, equivalent degree/experience routes, duration scope, conditional eligibility and embedded instructions. Labels are agent-authored development labels, not independent human review or held-out accuracy evidence. [The baseline manifest](../backend/config/matching-evaluation/baseline.json) records previous feature/scoring versions, committed base and SHA-256 hashes of the actual legacy source, including prior uncommitted work.

Localization checks source-span overlap and importance, requiring intersection over union of at least 0.5. It does not measure entailment, domain/scope correctness or ranking quality. Duplicate predictions count against precision. Empty denominators return null; failed samples remain in recall. Logic and duration diagnostics are separate.

The initial rules run completed all 18 cases: 17/17 labeled qualifications localized, 15/17 expressions matched labeled logic, 2/3 explicit durations matched, and nine cases needed review. The original latency/failover paraphrases still produce no resume skills and the sparse Python comparison retains the legacy high score. This increment makes those gaps reproducible; it has not fixed them with a model.

## Local model commands

The adapter requires an independently installed local Ollama runtime and an explicitly pinned model. Jobbely does not pull or install weights. Configure the operator process without replacing existing environment files:

```powershell
$env:SEMANTIC_JOB_MODEL = '<installed-local-model:explicit-tag>'
$env:SEMANTIC_JOB_MODEL_DIGEST = '<64-character-installed-weight-digest>'
$env:SEMANTIC_JOB_BASE_URL = 'http://127.0.0.1:11434'
pnpm matching:evaluate --strategy ollama
```

Get the installed name/digest from `GET http://127.0.0.1:11434/api/tags`; [the Ollama API](https://docs.ollama.com/api/tags) documents those fields. Placeholder digests fail validation. Model and quantization identity are checked before and after inference.

With PostgreSQL configured, inspect a stored public job:

```powershell
pnpm matching:shadow --job '<stored-public-posting-id>'
```

This reads the current catalog posting and structured HTML/text, then prints rules and validated experimental interpretations. It does not fetch provider listings, save features, alter schedules or accept candidate profiles. Model failure retains the baseline and returns a nonzero exit code. Retained raw public output belongs in ignored local data, not committed benchmark evidence.

## Resource and privacy invariants

Endpoints must be literal HTTP loopback (`127.0.0.1` or `::1`), without credentials, paths, queries or redirects. Remote-model metadata and cloud-style names are rejected. Disable cloud features in the actual runtime using [Ollama's local-only configuration](https://docs.ollama.com/faq#how-do-i-disable-ollama-cloud-features). Verify telemetry and payload logging independently; loopback is not proof of a private runtime configuration.

Requests use [structured JSON output](https://docs.ollama.com/capabilities/structured-outputs), no tools, non-streaming completion, an 8,192-token context setting, 4,096-token output limit and immediate model unload. Inputs are capped at 16,000 characters, 100 blocks and 2,000 characters per block. Oversized input fails explicitly; chunking is pending. One extraction is admitted at a time, with a 60-second end-to-end deadline, cancellation, rejection of partial generation and a 1 MiB response-byte limit. Errors expose codes and generic messages, not input/model payloads.

Employer text is untrusted data. Prompt instructions alone cannot prevent semantically wrong output; validation and independent quality gates remain required. The model has no tool permissions.

No browser worker isolation, profile allowlist, cursor, API or feature-publication transaction changed. No candidate data is stored and no model queue is created. See [RESUME_PRIVACY](RESUME_PRIVACY.md), [DOCUMENTS](DOCUMENTS.md) and [JOB_FEATURES](JOB_FEATURES.md).

## Verification and next gates

New tests exercise requirement alternatives/conjunctions/conditions, unknown denominators, contradiction precedence, source borrowing/omission, numeric/source forgery, model drift, endpoint restrictions, input/output bounds, in-flight cancellation, concurrency admission, timeout and generic failures. Development evaluation and strict backend type checking run successfully.

Final verification on 4 October: root `pnpm check` passed formatting, boundaries, logo assets, zero-warning lint, both strict type checks, contract generation and production builds, with 464 backend and 23 frontend tests passing. This includes 48 new backend tests. Nine PostgreSQL tests were skipped in that standard run. The separate attempt to run `pnpm check` using the existing dedicated `TEST_DATABASE_URL` failed with `ECONNREFUSED 127.0.0.1:55432`; database correctness was not verified by this increment. No persistence/migration code changed. Documentation links resolved and baseline source hashes retained zero drift.

`pnpm matching:evaluate` completed successfully. `pnpm matching:evaluate --strategy ollama` returned a generic `unavailable` error because the local runtime/model configuration is not ready. Mock transport tests validate adapter behavior, not actual Ollama/model compatibility or extraction accuracy. No new browser checks were needed for this increment, which changes no UI behavior.

The developer machine reports about 62 GiB RAM and 32 logical CPUs; GPU details and the production host remain unverified. Ollama was unavailable at the default local endpoint. No actual model accuracy, retrieval quality or held-out ranking benchmark has run.

Phase 0 and Phase 1 are not fully complete: independent labels/splits, target-host budgets, public candidate contracts and a requirement-level comparator remain outstanding. The next gate is a configured local runtime followed by public-job/synthetic model evaluation. Production matching must remain on the known policy until evidence supports the new mode.
