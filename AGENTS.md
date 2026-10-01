# Agent guide for Jobbely

These instructions apply throughout this repository. Read this file before making changes, then consult the documentation for the affected concern.

## Start here

- [README.md](README.md): what the app does, local setup, commands and hosting overview.
- [MVP_PLAN.md](MVP_PLAN.md): product scope and MVP boundaries.
- [docs/README.md](docs/README.md): architecture reference index. Read the relevant decision documents before changing their implementation; verify their statements against current code.
- [docs/QUALITY.md](docs/QUALITY.md) and [docs/FORMATTING.md](docs/FORMATTING.md): checks, code style and verification limits.

Inspect the working tree before editing. Preserve existing user changes and work from other agents. Keep changes focused on the request.

## Project boundaries

Jobbely collects public employer job listings and categorizes them without AI. TypeScript lives in independent `/backend` and `/frontend` packages. Use the Node.js and pnpm versions declared in the root `package.json`.

- Keep provider-specific payloads, network access and persistence in backend infrastructure. Extend job-board support through adapters and existing ports.
- Keep domain policies pure and application workflows independent of concrete adapters/storage. Follow the dependency rules in [ARCHITECTURE.md](docs/ARCHITECTURE.md); bootstrap owns dependency wiring.
- The frontend consumes the public API and generated OpenAPI types. Do not import backend internals or expose database/provider records directly.
- Regenerate contracts with `pnpm contracts` after public API/schema changes. Do not hand-edit generated API or Prisma code.
- Preserve stable company/source identifiers. A configured company, successful import or candidate board does not establish complete employer coverage. Follow the source-audit and lifecycle gates before enabling scheduling or closure.
- Demo listings must remain visibly synthetic. Preserve availability, coverage and original employer/application links.
- Keep secrets, local database data and raw audit output out of committed files. Preserve existing environment settings.

## Documentation by concern

| Concern                                          | References                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Layers, patterns and dependency direction        | [ARCHITECTURE.md](docs/ARCHITECTURE.md)                                                        |
| Job-board adapters and network access            | [ADAPTER.md](docs/ADAPTER.md), [HTTP.md](docs/HTTP.md)                                         |
| Enterprise integrations and Wave B limits        | [WAVE_B.md](docs/WAVE_B.md)                                                                    |
| Native integrations and Wave C priority limits   | [WAVE_C.md](docs/WAVE_C.md)                                                                    |
| Deferred employers and Wave D scope              | [WAVE_D.md](docs/WAVE_D.md)                                                                    |
| Resume analysis and planned matching             | [RESUME_PLAN.md](RESUME_PLAN.md), [RESUME.md](docs/RESUME.md), [MATCHING.md](docs/MATCHING.md) |
| Resume privacy and planned file isolation        | [RESUME_PRIVACY.md](docs/RESUME_PRIVACY.md)                                                    |
| Evidence-backed source activation                | [AUDITING.md](docs/AUDITING.md)                                                                |
| Ingestion, workers, scheduling and source audits | [INGESTION.md](docs/INGESTION.md), [SOURCES.md](docs/SOURCES.md)                               |
| Persistence, transactions and posting lifecycle  | [STORAGE.md](docs/STORAGE.md), [LIFECYCLE.md](docs/LIFECYCLE.md)                               |
| Deterministic categorization                     | [CLASSIFICATION.md](docs/CLASSIFICATION.md)                                                    |
| Public API, validation and security              | [API.md](docs/API.md), [SECURITY.md](docs/SECURITY.md)                                         |
| React state, navigation and request handling     | [FRONTEND.md](docs/FRONTEND.md)                                                                |
| Visual design, typography and local assets       | [DESIGN.md](docs/DESIGN.md), [LOGOS.md](docs/LOGOS.md)                                         |
| Style and verification                           | [FORMATTING.md](docs/FORMATTING.md), [QUALITY.md](docs/QUALITY.md)                             |
| Hosting and operations                           | [DEPLOYMENT.md](docs/DEPLOYMENT.md)                                                            |
| Dated live-source evidence                       | [SOURCE_CHECKS.md](docs/SOURCE_CHECKS.md)                                                      |

When changing an architecture decision, update its document and the reference index. For a new decision, add an uppercase concern filename in `/docs` with status/date, rationale, invariants, implementation links and verification. Distinguish proposed work from implemented behavior; dated evidence is not a permanent guarantee.

## Required completion checks

For resume changes, distinguish the implemented pasted-text increment from proposed matching/file-upload work. Use [RESUME_TESTING.md](docs/RESUME_TESTING.md) for its synthetic evaluation corpus and review checks; never add real candidate data to fixtures or logs.

**After writing or modifying code, always run the root linter against the final code before reporting completion:**

```sh
pnpm lint
```

- Lint must finish successfully with zero warnings. A run before the last code edit does not satisfy this requirement; rerun it after subsequent edits.
- Fix issues introduced by your changes and rerun lint. Do not silence rules or weaken configuration to make the check pass.
- `pnpm lint:fix` and `pnpm format` can apply fixes, but do not replace the final read-only lint check. Formatting fixes also count as code edits.
- A successful `pnpm check` satisfies this requirement because it runs the root linter. An interrupted or failing run that never reaches the lint step does not.
- If a check cannot run, report the exact command, blocker and unverified result. If existing unrelated work fails lint, identify it without overwriting that work or claiming lint passed.

Use `pnpm format` for shared Prettier layout and ESLint blank-line rules. Keep functions, methods and logical variable groups readable. Prefer type-only imports, strict types and existing abstractions over duplicated provider logic or unnecessary layers.

Run additional checks appropriate to the change: type checking and behavior tests for code, contract generation for API changes, PostgreSQL tests for persistence/concurrency changes, and browser checks for UI behavior and responsive layouts. Run `pnpm check` before a release. PostgreSQL tests skipped without `TEST_DATABASE_URL` are not evidence of database correctness. See [QUALITY.md](docs/QUALITY.md) for the complete procedure.

Documentation-only changes need formatting and link/command validation; do not claim application tests were run unless they actually were. In the final response, summarize the outcome, checks actually run and any remaining limitations.
