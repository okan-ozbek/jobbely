# Decision: deterministic classification strategies

**Status:** Strategy chain implemented; persisted override configuration and replay command deferred. Recorded 30 September 2026.

## Decision and rationale

Use a canonical function taxonomy while retaining the company's original department/team labels. Classification uses deterministic rules with no AI calls. An ordered `ClassificationStrategy` list forms a chain of responsibility: the first decisive classification wins.

Current precedence is company-specific label mapping, global exact label mapping, specific title rules, then `unclassified`. `LabelMappingStrategy` accepts company overrides through its constructor, but bootstrap currently supplies none. Adding a mapping does not require changing provider adapters.

## Invariants

- Source labels are preserved separately from the canonical category.
- Decisions carry category, method, rule, evidence and policy version. The current version is `1`.
- Global labels are trimmed/lowercased and matched exactly. Conflicting categories defer to the next strategy.
- Title rules require one unambiguous category; a title containing multiple different matched functions remains unclassified.
- `unclassified` is an explicit valid outcome. Broad team names alone are insufficient evidence.

Taxonomy includes engineering, data/AI, research, quant/trading, product, design, sales, marketing, customer support, people, finance, legal, security/IT, operations, manufacturing, retail, creative and unclassified. Provider workplace and employment normalization are separate concerns.

## Tradeoffs and changes

Conservative matching improves explainability but leaves unfamiliar teams and titles unclassified. Original fields allow later review without new extraction. Current rule strings/version are code-owned; there is no rule editor or automated coverage report.

When changing rules, add representative and ambiguous examples, review interactions with earlier strategies, and increment the policy version for a behavior change. Re-ingestion recalculates classification and the normalized hash. A future replay command should reclassify stored evidence and publish changes transactionally; that command is not implemented yet. Avoid unreviewed substring mappings that broadly assign unrelated roles.

## Implementation and verification

[Taxonomy](../backend/src/domain/taxonomy.ts), [strategy contract and rules](../backend/src/domain/classification.ts), [decision model](../backend/src/domain/model.ts), [classification behavior tests](../backend/src/domain/policies.test.ts), [bootstrap strategy order](../backend/src/bootstrap.ts).

See [ADAPTER.md](ADAPTER.md) for original labels and [LIFECYCLE.md](LIFECYCLE.md) for content-change identity.
