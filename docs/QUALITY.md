# Decision: strict boundaries and behavior-based verification

**Status:** Initial checks implemented; CI automation and browser suite deferred. Recorded 30 September 2026.

## Decision and rationale

Use strict TypeScript, explicit dependency direction and tests of externally meaningful behavior. Do not rely on provider happy paths, an in-memory repository, or a generated type alone to establish live/database correctness.

Domain code depends only on domain code. Ports may depend on domain/ports. Application code may depend on domain/ports/application and currently allows `node:crypto` for hashes/cursors. Infrastructure implements those ports; bootstrap wires dependencies explicitly. Frontend code does not import backend internals.

## Commands and gates

| Command             | Gate                                                                           |
| ------------------- | ------------------------------------------------------------------------------ |
| `pnpm lint`         | ESLint, consistent type imports, no explicit `any`, zero warnings              |
| `pnpm format`       | Prettier, rewrites backend/frontend/scripts/docs to the canonical style        |
| `pnpm format:check` | Prettier in check mode; fails without writing, for CI/pre-merge use            |
| `pnpm typecheck`    | Strict checking in both packages and Prisma client generation                  |
| `pnpm test`         | Backend policies, adapters, HTTP, use cases, API and optional PostgreSQL tests |
| `pnpm contracts`    | OpenAPI export and generated frontend contract                                 |
| `pnpm build`        | Backend client/code build, contract generation and frontend production build   |
| `pnpm check`        | Dependency boundaries followed by lint, types, tests and builds                |

The base TypeScript settings include unchecked-index and exact-optional-property checks and unused-variable checks. `check-boundaries.mjs` checks literal import/module references in production domain/application/ports and frontend sources. It is a lightweight textual guard, not complete static dependency analysis. Tests are excluded from the backend layer restriction to allow test fixtures/fakes.

### Linting and formatting

[`eslint.config.mjs`](../eslint.config.mjs) at the repository root configures `typescript-eslint`'s recommended rules plus `consistent-type-imports` and a ban on explicit `any`, applied to `backend/src`, `frontend/src` and `scripts`. Prettier formats the same TypeScript/TSX sources plus `docs`, root JSON/YAML and `README.md`; root [`.prettierignore`](../.prettierignore) and the package-local `backend/.prettierignore` / `frontend/.prettierignore` exclude generated Prisma/OpenAPI output and build directories.

Run both checks from the repository root, across both packages at once:

```powershell
pnpm lint             # ESLint, zero warnings allowed
pnpm lint:fix         # ESLint with autofix
pnpm format           # Prettier, rewrites files in place
pnpm format:check     # Prettier in check mode, no writes (use in CI)
```

Or scope either check to a single package:

```powershell
pnpm --filter @jobbely/backend run lint
pnpm --filter @jobbely/backend run format
pnpm --filter @jobbely/frontend run lint
pnpm --filter @jobbely/frontend run format
```

Because ESLint's flat config is resolved by walking up from the current directory, package-scoped runs still pick up the root `eslint.config.mjs`. `pnpm check` runs `pnpm lint` but not `pnpm format`; run formatting explicitly before committing, or wire `format:check` into CI alongside `check`.

Formatting uses Prettier. Generated outputs, build directories and installed dependencies are excluded where appropriate. Keep lockfile changes intentional and use frozen installs for reproduction.

## Verification levels

Unit/behavior tests use fake transport and memory storage for malformed fields, pagination repetition, exclusions, classification ambiguity, idempotency, quarantine, HTML preparation, failures and cursors. They do not verify public provider availability.

PostgreSQL tests require a dedicated `TEST_DATABASE_URL` whose database name starts with `jobbely_test_`. They initialize the initial schema when missing and use unique sources without deleting existing data. With no variable they are skipped, so a default test pass is not a database integration pass. Provision that database separately and keep its connection secret.

The initial implementation passed 35 tests including four against PostgreSQL. Live checks covered three provider boards; browser checks exercised the working UI. These are dated results, not claims about future edits. Queue recovery, production hosting/load, full employer coverage and automated browser regression remain separate pending gates.

## Change procedure

Run checks appropriate to the affected behavior, and run `pnpm check` before a release. Regenerate contracts for public-schema changes. Add PostgreSQL verification for transaction/concurrency changes and representative live audits for provider changes. Documentation-only updates require formatting, link/command validation and review against code, without claiming deployment tests.

[Type settings](../tsconfig.base.json), [lint config](../eslint.config.mjs), [boundary guard](../scripts/check-boundaries.mjs), [tests](../backend/src/), [PostgreSQL suite](../backend/src/infrastructure/storage/postgres.test.ts), [live evidence](SOURCE_CHECKS.md). Keep related architecture references current when changing their invariants.
