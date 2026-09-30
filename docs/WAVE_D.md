# Decision: Wave D deferred employers

**Status:** Planned integrations; registry and CLI wave support implemented. Recorded 1 October 2026, Europe/Amsterdam.

## Scope and rationale

These employers were originally planned for Wave C but had no configured sources when the first five priorities were implemented. The user explicitly deferred them to Wave D. This change records that delivery boundary; it adds no adapters, sources, audit plans or job imports.

| Company        | Stable company slug |
| -------------- | ------------------- |
| Microsoft      | `microsoft`         |
| Oracle         | `oracle`            |
| X (Twitter)    | `x`                 |
| IBM            | `ibm`               |
| JPMorgan Chase | `jpmorgan`          |
| Goldman Sachs  | `goldman-sachs`     |
| ABN AMRO       | `abn-amro`          |

The 60-company registry now contains 10 Wave A, 31 Wave B, 12 Wave C and seven Wave D employers. Wave C still selects the five configured priorities. The other seven Wave C employers remain unconfigured. Source counts and integration results are unchanged.

## Invariants and operator behavior

Planning membership does not establish onboarding or employer coverage. These seven companies retain their stable IDs, careers URLs and local logos, with `not_onboarded` coverage because they have no sources. Missing imported listings do not mean the employer has no vacancies. Registry changes require running API/worker processes to restart.

The selector accepts `--wave D`. Root aliases are available for future onboarding:

```powershell
pnpm sync:wave-d
pnpm audit:wave-d
```

Both currently exit with `No matching sources for the requested selection.` before attempting extraction. Do not add placeholder sources or synthetic listings to make these commands succeed. Once candidate sources exist, the commands select them according to company wave, using the same sync/audit workflow as other cohorts.

## Future onboarding

Follow [SOURCES.md](SOURCES.md), [ADAPTER.md](ADAPTER.md) and [AUDITING.md](AUDITING.md): discover official boards, establish employer attribution and permitted access, reuse compatible adapters or implement dedicated ones, verify complete pagination and details, then review scope/access evidence before activation. Provider hypotheses in [the MVP inventory](../MVP_PLAN.md) remain hypotheses until verified. No discovery or live-source validation is performed by this deferral.

## Implementation and verification

- [Company registry](../backend/config/companies.json) owns cohort membership; [source registry](../backend/config/sources.json) owns actual integrations.
- [Domain model](../backend/src/domain/model.ts), [registry validation](../backend/src/infrastructure/registry.ts) and [CLI selection](../backend/src/cli/select-sources.ts) accept Wave D.
- [Selection tests](../backend/src/cli/select-sources.test.ts) verify the exact deferred cohort, the explicit empty-source error and selection when a future source is present.
- [Root scripts](../package.json) provide aliases. Verify changes with formatting, root lint, strict types and selection tests. Keep live integration evidence separate from these planning checks.
