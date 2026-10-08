# Decision: strict boundaries and behavior-based verification

**Status:** Initial checks implemented; CI automation and browser suite deferred. Recorded 30 September 2026.

## Decision and rationale

Use strict TypeScript, explicit dependency direction and tests of externally meaningful behavior. Do not rely on provider happy paths, an in-memory repository, or a generated type alone to establish live/database correctness.

Domain code depends only on domain code. Ports may depend on domain/ports. Application code may depend on domain/ports/application and currently allows `node:crypto` for hashes/cursors. Infrastructure implements those ports; bootstrap wires dependencies explicitly. Frontend code does not import backend internals.

## Commands and gates

| Command             | Gate                                                                           |
| ------------------- | ------------------------------------------------------------------------------ |
| `pnpm lint`         | ESLint, consistent type imports, no explicit `any`, zero warnings              |
| `pnpm format`       | ESLint fixes/blank-line grouping followed by Prettier layout                   |
| `pnpm format:check` | Prettier in check mode; fails without writing, for CI/pre-merge use            |
| `pnpm typecheck`    | Strict checking in both packages and Prisma client generation                  |
| `pnpm test`         | Backend policies, adapters, HTTP, use cases, API and optional PostgreSQL tests |
| `pnpm contracts`    | OpenAPI export and generated frontend contract                                 |
| `pnpm logos:check`  | Local company assets exist and match their recorded hashes/signatures          |
| `pnpm build`        | Backend client/code build, contract generation and frontend production build   |
| `pnpm check`        | Formatting, boundaries, logo assets, lint, types, tests and builds             |

The base TypeScript settings include unchecked-index and exact-optional-property checks and unused-variable checks. `check-boundaries.mjs` checks literal import/module references in production domain/application/ports and frontend sources. It is a lightweight textual guard, not complete static dependency analysis. Tests are excluded from the backend layer restriction to allow test fixtures/fakes.

### Linting and formatting

[`eslint.config.mjs`](../eslint.config.mjs) configures `typescript-eslint`'s recommended rules, type-only imports, a ban on explicit `any`, explicit control-flow braces and strict equality. ESLint Stylistic adds blank lines between declarations, class methods and logical statement groups. It checks sources, TypeScript configuration files, supporting scripts and the lint configuration itself. Prettier uses the shared [`.prettierrc.json`](../.prettierrc.json) and scans the repository, including package configuration files. Root [`.prettierignore`](../.prettierignore) and package-local ignore files exclude generated outputs, builds, dependencies, secrets and local data. See [FORMATTING.md](FORMATTING.md) for the style and rationale.

Run both checks from the repository root, across both packages at once:

```powershell
pnpm lint             # ESLint, zero warnings allowed
pnpm lint:fix         # ESLint with autofix
pnpm format           # ESLint fixes/spacing, then Prettier; rewrites files
pnpm format:check     # Prettier in check mode, no writes (use in CI)
```

Or scope either check to a single package:

```powershell
pnpm --filter @jobbely/backend run lint
pnpm --filter @jobbely/backend run format
pnpm --filter @jobbely/frontend run lint
pnpm --filter @jobbely/frontend run format
```

Package-scoped runs pick up the shared root ESLint and Prettier configurations. `pnpm check` begins with `format:check` and also runs lint; it never rewrites files. Use `pnpm format` to apply both ESLint spacing/fixes and Prettier layout before running checks.

Formatting uses Prettier. Generated outputs, build directories and installed dependencies are excluded where appropriate. Keep lockfile changes intentional and use frozen installs for reproduction.

## Verification levels

Unit/behavior tests use fake transport and memory storage for malformed fields, pagination repetition, exclusions, classification ambiguity, idempotency, quarantine, HTML preparation, failures and cursors. They do not verify public provider availability.

PostgreSQL tests require a dedicated `TEST_DATABASE_URL` whose database name starts with `jobbely_test_`. They initialize the initial schema when missing and use unique sources without deleting existing data. With no variable they are skipped, so a default test pass is not a database integration pass. Provision that database separately and keep its connection secret.

Earlier test counts and browser observations are preserved in [historical verification results](REFERENCE_HISTORY.md#historical-verification-results). They do not establish correctness for subsequent edits.

## Iteration and final verification

**Workflow update:** 8 October 2026. Scope the reading and development checks to the change, then retain every applicable completion gate. This changes when checks run, not the standard they must meet.

| Change                       | Development and completion evidence                                                                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation only           | Format changed documents; validate local links/anchors and documented commands against manifests/code. Application tests/builds are unnecessary unless executable behavior also changed.                                                                                              |
| Frontend behavior or styling | Frontend typecheck, relevant behavior tests where available, and browser checks of changed flows plus responsive layouts. The current frontend test script covers resume helpers/document parsing, not account or general UI rendering; passing it does not replace browser evidence. |
| Backend policy/workflow      | Backend typecheck and relevant behavior tests; include adjacent callers/failure paths when the behavior affects them.                                                                                                                                                                 |
| API/schema                   | `pnpm contracts`, typecheck both packages and affected route/consumer behavior. Do not hand-edit generated files.                                                                                                                                                                     |
| Persistence/concurrency      | Relevant PostgreSQL tests with a dedicated `TEST_DATABASE_URL`, including transaction/retry/race behavior; memory tests alone cannot verify this.                                                                                                                                     |
| Provider/source behavior     | Relevant adapter/transport/workflow tests and representative live audits; retain source coverage, access and lifecycle gates.                                                                                                                                                         |
| Release/deployment           | Root `pnpm check` plus applicable database, live-source and browser verification above.                                                                                                                                                                                               |

During implementation, use a focused test command rather than repeating the entire release suite after every small edit. For example, from the repository root:

```powershell
pnpm --filter @jobbely/frontend typecheck
pnpm --filter @jobbely/backend typecheck
pnpm --filter @jobbely/backend exec vitest run src/api/accounts.test.ts
pnpm --filter @jobbely/frontend exec vitest run --configLoader runner src/features/resume/skill-tenure.test.ts
```

Select actual affected tests, including meaningful neighboring behavior; the examples are not a fixed checklist for every task. Broaden after failures, cross-boundary changes or unresolved risk. Use [task routes](README.md#task-routes) to locate the owning code/decisions rather than reading all plans and employer histories.

Finish the edits, format, inspect the diff, then run final checks. For a focused edit, apply the same shared formatters to the changed files (`pnpm exec eslint <code-files> --fix`, then `pnpm exec prettier <changed-files> --write`); use `pnpm format` for a repository-wide formatting task. Avoid rewriting unrelated work. Formatter fixes are code edits, so final root `pnpm lint` must follow them. `pnpm check` is the complete release gate and includes read-only formatting/lint checks.

Reuse successful verification while code, dependencies and relevant configuration remain unchanged. Any subsequent edit requires final root lint again and the checks affected by that edit; before release, rerun the complete gate against the final state. External-service/database observations remain bounded to their environment and time. Report exactly what ran, what was skipped and what remains unverified.

Agents must follow [AGENTS.md](../AGENTS.md): after writing or modifying code, run the root `pnpm lint` against the final code and require zero warnings before reporting completion. Rerun after any further code edits. A successful `pnpm check` includes this lint gate; formatting/autofix alone does not replace it. Report failures or blockers accurately.

Run checks appropriate to the affected behavior, and run `pnpm check` before a release. Regenerate contracts for public-schema changes. Add PostgreSQL verification for transaction/concurrency changes and representative live audits for provider changes. Documentation-only updates require formatting, link/command validation and review against code, without claiming deployment tests.

[Type settings](../tsconfig.base.json), [lint config](../eslint.config.mjs), [boundary guard](../scripts/check-boundaries.mjs), [tests](../backend/src/), [PostgreSQL suite](../backend/src/infrastructure/storage/postgres.test.ts), [live evidence](SOURCE_CHECKS.md). Keep related architecture references current when changing their invariants.
