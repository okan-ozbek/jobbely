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

The initial implementation passed 35 tests including four against PostgreSQL. Live checks covered three provider boards; browser checks exercised the working UI. These are dated results, not claims about future edits. Queue recovery, production hosting/load, full employer coverage and automated browser regression remain separate pending gates.

Wave B adds behavior coverage for Workday capped partitions, the later-page total sentinel, full hydration, immutable IDs, canonical tenant links, iCIMS employer scope, POST restrictions, stored request provenance and lease renewal. On 30 September 2026 (UTC), the complete suite passed 84 tests against a dedicated `jobbely_test_wave_b` PostgreSQL database. The default `pnpm check` run skips the six database tests when its environment lacks `TEST_DATABASE_URL`; a separate passing database run remains required evidence. See [WAVE_B.md](WAVE_B.md) and [SOURCE_CHECKS.md](SOURCE_CHECKS.md) for live-source limits.

## Change procedure

Agents must follow [AGENTS.md](../AGENTS.md): after writing or modifying code, run the root `pnpm lint` against the final code and require zero warnings before reporting completion. Rerun after any further code edits. A successful `pnpm check` includes this lint gate; formatting/autofix alone does not replace it. Report failures or blockers accurately.

Run checks appropriate to the affected behavior, and run `pnpm check` before a release. Regenerate contracts for public-schema changes. Add PostgreSQL verification for transaction/concurrency changes and representative live audits for provider changes. Documentation-only updates require formatting, link/command validation and review against code, without claiming deployment tests.

[Type settings](../tsconfig.base.json), [lint config](../eslint.config.mjs), [boundary guard](../scripts/check-boundaries.mjs), [tests](../backend/src/), [PostgreSQL suite](../backend/src/infrastructure/storage/postgres.test.ts), [live evidence](SOURCE_CHECKS.md). Keep related architecture references current when changing their invariants.
