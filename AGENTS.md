# Agent guide for Jobbely

These instructions apply throughout this repository. Read this file before making changes, then consult the documentation for the affected concern.

## Start with the task

1. Inspect the working tree; preserve user changes and work from other agents. Keep edits focused on the request.
2. Select the affected rows in [task routes](docs/README.md#task-routes). Read their owner documents and follow the code links before editing. Expand to adjacent concerns when dependencies or behavior cross their boundaries.
3. Use [QUALITY.md](docs/QUALITY.md#iteration-and-final-verification) to select checks. Consult [FORMATTING.md](docs/FORMATTING.md) when changing style/configuration or resolving formatter issues.

[README.md](README.md) is for setup/commands/hosting; [MVP_PLAN.md](MVP_PLAN.md) is for product scope decisions. Plans, employer inventories and dated history are on-demand references, not mandatory reading for every task. Reuse context already read in this task; reread when the file changes, scope expands or code contradicts it. Routing does not replace the relevant decision or its invariants.

## Project boundaries

Jobbely collects public employer job listings and categorizes them without AI. TypeScript lives in independent `/backend` and `/frontend` packages. Use the Node.js and pnpm versions declared in the root `package.json`.

- Keep provider-specific payloads, network access and persistence in backend infrastructure. Extend job-board support through adapters and existing ports.
- Keep domain policies pure and application workflows independent of concrete adapters/storage. Follow the dependency rules in [ARCHITECTURE.md](docs/ARCHITECTURE.md); bootstrap owns dependency wiring.
- The frontend consumes the public API and generated OpenAPI types. Do not import backend internals or expose database/provider records directly.
- Regenerate contracts with `pnpm contracts` after public API/schema changes. Do not hand-edit generated API or Prisma code.
- Preserve stable company/source identifiers. Configuration, import or a candidate board does not establish complete employer coverage. Follow source-audit, scheduling and lifecycle decisions; the explicit schedule override does not override access, coverage or closure gates.
- Demo listings must remain visibly synthetic. Preserve availability, coverage and original employer/application links.
- Keep secrets, local database data and raw audit output out of committed files. Preserve existing environment settings.

When changing an architecture decision, update its document and the reference index. For a new decision, add an uppercase concern filename in `/docs` with status/date, rationale, invariants, implementation links and verification. Distinguish proposed work from implemented behavior; dated evidence is not a permanent guarantee.

## Required completion checks

For skill inference, evidence colors and description comparison, read [docs/SKILL_RELATIONS.md](docs/SKILL_RELATIONS.md). Inferred skills must remain distinguishable from direct claims and must never establish activity-specific tenure.

For resume changes, preserve transient candidate state and distinguish the implemented flow from proposed OCR, structured eligibility and production calibration work. Read [RESUME_PRIVACY.md](docs/RESUME_PRIVACY.md) and [RESUME_TESTING.md](docs/RESUME_TESTING.md). For parser/worker changes also read [DOCUMENTS.md](docs/DOCUMENTS.md); for feature projection/backfill/publication changes read [JOB_FEATURES.md](docs/JOB_FEATURES.md). Never add real candidate data to fixtures or logs.

**After writing or modifying code, always run the root linter against the final code before reporting completion:**

```sh
pnpm lint
```

- Lint must finish successfully with zero warnings. A run before the last code edit does not satisfy this requirement; rerun it after subsequent edits.
- Fix issues introduced by your changes and rerun lint. Do not silence rules or weaken configuration to make the check pass.
- `pnpm lint:fix` and `pnpm format` can apply fixes, but do not replace the final read-only lint check. Formatting fixes also count as code edits.
- A successful `pnpm check` satisfies this requirement because it runs the root linter. An interrupted or failing run that never reaches the lint step does not.
- If a check cannot run, report the exact command, blocker and unverified result. If existing unrelated work fails lint, identify it without overwriting that work or claiming lint passed.

Use the shared Prettier/ESLint formatters, scoped to changed files as described in [QUALITY.md](docs/QUALITY.md#iteration-and-final-verification), or `pnpm format` for repository-wide work. Keep logical groups readable; prefer type-only imports, strict types and existing abstractions over duplicated provider logic or unnecessary layers.

Run additional checks appropriate to the change: type checking and behavior tests for code, contract generation for API changes, PostgreSQL tests for persistence/concurrency changes, and browser checks for UI behavior and responsive layouts. Run `pnpm check` before a release. PostgreSQL tests skipped without `TEST_DATABASE_URL` are not evidence of database correctness. See [QUALITY.md](docs/QUALITY.md) for the complete procedure.

Documentation-only changes need formatting and link/command validation; do not claim application tests were run unless they actually were. In the final response, summarize the outcome, checks actually run and any remaining limitations.
