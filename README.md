# Jobbely

Jobbely collects public employer job listings, categorizes them without AI, and lets you search full descriptions and apply on the original company website.

Agents should start with [AGENTS.md](AGENTS.md) for repository boundaries, documentation references and required completion checks.

The **Resume** page reads text or a local PDF/DOCX, shows reading order and claims, and lets you correct the profile before requesting explained job recommendations. It covers engineering, data/AI, product, sales and people, with explicit gaps, uncertainty and freshness. Candidate data stays transient; only public job features are persisted. Try the synthetic examples in [RESUME_TESTING](docs/RESUME_TESTING.md); see [RESUME_PLAN](RESUME_PLAN.md) for broader follow-ups.

TypeScript lives in separate `/frontend` and `/backend` packages. Integrations support Greenhouse, Ashby, Lever, Workday, iCIMS/Jibe and the first native Wave C boards. All 60 employers are registered, with sources for all 10 Wave A and 31 Wave B companies plus Meta, Apple, Netflix, Google and Amazon. Wave B full imports succeeded for 29 companies; NVIDIA has a malformed feed and LinkedIn requires an authorized feed. Meta and Google also have explicit access blockers. Full employer coverage remains under audit. See [the MVP boundaries](MVP_PLAN.md), [Wave B](docs/WAVE_B.md), [Wave C](docs/WAVE_C.md) and [dated source checks](docs/SOURCE_CHECKS.md).

## Prerequisites

- Node.js **24** and pnpm **12.6.0**, matching `package.json`.
- PostgreSQL for real listings; Docker with Compose is the included local database option.
- Internet access for installing packages and fetching public job feeds.

Install pnpm if needed:

```powershell
npm install --global pnpm@12.6.0
```

Run the commands below from the repository root unless a different directory is specified. Local examples use PowerShell; the deployment guide also includes Linux commands.

## Run locally: synthetic preview

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
$env:DATA_MODE = "demo"
pnpm dev
```

Open **http://127.0.0.1:5173/**. The API runs at **http://127.0.0.1:3001/**. Preview mode needs no database and clearly labels its synthetic examples. Its data resets when the backend restarts.

Use `Ctrl+C` to stop the servers. Environment variables override `backend/.env`; use a fresh terminal when switching modes, or explicitly change `DATA_MODE` again.

## Run locally: real listings with PostgreSQL

1. Install dependencies if you have not done so:

   ```powershell
   pnpm install --frozen-lockfile
   ```

2. Start the included development database:

   ```powershell
   docker compose up -d --wait
   ```

   Compose exposes PostgreSQL only at `127.0.0.1:5432`. It uses the local development database/user/password `jobbely`, and persists data in a Docker volume.

3. Create the backend configuration if it does not exist:

   ```powershell
   if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
   ```

   Edit `backend/.env` to match your database:

   ```dotenv
   DATA_MODE=postgres
   DATABASE_URL=postgresql://jobbely:jobbely@127.0.0.1:5432/jobbely
   HOST=127.0.0.1
   PORT=3001
   FRONTEND_ORIGIN=http://127.0.0.1:5173
   ```

   An existing `.env` may point to another database. Keep its settings if you intend to use that database; adjust them if you intend to use Compose. Existing machine configuration from the first implementation uses an ignored project-local PostgreSQL cluster on port **55432**. That cluster is a development artifact, not part of the portable setup.

4. Generate the database client, apply migrations, and import a public feed:

   ```powershell
   $env:DATA_MODE = "postgres"
   pnpm db:generate
   pnpm db:migrate
   pnpm sync:wave-a
   ```

   This imports all 10 Wave A companies, including both Radix Trading boards. Run `pnpm sync:wave-b` to import Wave B. Large Workday boards take tens of minutes because every detail is retrieved with host pacing. NVIDIA and LinkedIn currently fail explicitly, producing a nonzero command exit code; other sources continue. For an individual company, use `pnpm --filter @jobbely/backend run sync --company openai` (or another configured company slug). These commands read the public feeds and write to your configured database. An empty database shows no real listings until ingestion succeeds.

5. Start both applications:

   ```powershell
   pnpm dev
   ```

For the five configured Wave C priorities, run `pnpm sync:wave-c`. Netflix and Amazon use public JSON feeds; Apple reads its public search/detail pages. Apple's full initial detail import can take over 100 minutes at default pacing and fails if traversal changes or a required detail becomes unavailable. Meta and Google report access blockers, so the wave command returns a nonzero exit code while continuing other sources. See [WAVE_C.md](docs/WAVE_C.md) for exact limits and [SOURCE_CHECKS.md](docs/SOURCE_CHECKS.md) for which full imports have actually passed. Seven other Wave C companies remain unconfigured. Microsoft, Oracle, X (Twitter), IBM, JPMorgan Chase, Goldman Sachs and ABN AMRO are deferred to [Wave D](docs/WAVE_D.md). No integrations have been added for that cohort. The `sync:wave-d` and `audit:wave-d` aliases currently exit with "No matching sources for the requested selection." until sources are configured.

For independent development, use separate terminals:

```powershell
pnpm --filter @jobbely/backend run dev
pnpm --filter @jobbely/frontend run dev
```

The frontend development server proxies `/api` to port 3001. No frontend `.env` is needed with the default ports. Stop the servers with `Ctrl+C`; stop the Compose database with `docker compose stop`. Stopping it preserves the database volume.

## Host the application

For an existing PostgreSQL installation, apply `pnpm db:migrate`, then `pnpm features:backfill` before matching. Demo listings are excluded. Production PDF/DOCX reading requires the worker CSP headers in [DEPLOYMENT](docs/DEPLOYMENT.md); missing headers preserve pasted-text fallback.

Host the built frontend as static files, run the backend as a persistent Node process, and provide PostgreSQL. Use a reverse proxy to serve the frontend and route `/api/` to the backend under the same HTTPS origin.

| Component                      | Build/output                                            | Runtime                                     |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------- |
| Frontend                       | `frontend/dist/`                                        | Static hosting or reverse proxy             |
| API                            | `backend/dist/` plus `backend/config/` and dependencies | `pnpm --filter @jobbely/backend run start`  |
| Database                       | Versioned Prisma migrations                             | PostgreSQL with persistent storage          |
| Ingestion worker, when enabled | Same backend build/config                               | From `backend/`: `node dist/worker/main.js` |

For a release, install and build from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
pnpm --filter @jobbely/backend run start
```

Configure the backend's environment before migrations/start: `DATA_MODE=postgres`, `DATABASE_URL`, `HOST`, `PORT`, and `FRONTEND_ORIGIN`. The database URL must point to the hosted database. Keep `VITE_API_BASE_URL` empty for the same-origin reverse proxy; use the public API origin at **build time** when hosting frontend and API on different origins.

Follow [DEPLOYMENT.md](docs/DEPLOYMENT.md) for the complete hosting recipe, environment table, Nginx example, separate-origin setup, process commands, release checks, and upgrade procedure. Production hosting has not yet been deployed or load-tested; the documented topology is a deployment recipe. Use hosted secrets rather than the development database credentials.

## Ingestion and scheduling

Manual ingestion works in PostgreSQL mode:

```powershell
pnpm --filter @jobbely/backend run sync --company openai
```

Refresh the entire first-release cohort with `pnpm sync:wave-a`, equivalent to
`pnpm --filter @jobbely/backend run sync --wave A`. Wave selection uses the company registry
and includes every configured board for those companies, even when scheduling is disabled.
Choose exactly one selector: `--company <slug>`, `--wave <A|B|C|D>`, or `--all-enabled`
(scheduled sources only). A failed source is reported without preventing the remaining sources
from running; any failure gives the command a nonzero exit code. Manual ingestion does not
verify employer scope or enable scheduling.

Audit a company's official listings, hiring channels, policy evidence and provider feeds without publishing listings:

```powershell
pnpm --filter @jobbely/backend run audit --company openai
pnpm audit:wave-a
```

Raw audit evidence goes to ignored, timestamped `backend/data/audits/` directories; compact reports go to `backend/config/audit-evidence/`. Audits compare posting IDs, flag new boards, capture policy documents and require recorded scope/access approvals. See [AUDITING.md](docs/AUDITING.md) for review and activation commands. Candidate boards may be synced manually, but their missing postings cannot automatically close existing listings.

Sources in `backend/config/sources.json` are currently candidates with scheduling disabled. After the company passes its audit, `audit --company <slug> --activate` can verify its sources and enable schedules; manually setting the flags without passing evidence is rejected. Restart affected processes and run the separate development worker:

```powershell
pnpm --filter @jobbely/backend run worker
```

Schedules refresh enabled sources twice daily, staggered by minute in UTC. The API process does not start the worker. Validate scheduler retries/recovery before unattended operation; see [INGESTION.md](docs/INGESTION.md) and [SOURCES.md](docs/SOURCES.md).

## Checks and troubleshooting

```powershell
pnpm check
```

This checks formatting, dependency boundaries, lint, strict TypeScript, behavior/API tests, contract generation, and both builds. PostgreSQL tests run only when `TEST_DATABASE_URL` names a dedicated `jobbely_test_*` database; otherwise they are skipped. See [QUALITY.md](docs/QUALITY.md).

### Linting and formatting

ESLint (`typescript-eslint`) and Prettier cover both `/backend` and `/frontend`. Run them together from the repository root:

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

`pnpm check` runs `format:check` and `lint` without modifying files. Use `pnpm format` to apply ESLint's spacing/fixes followed by Prettier in one command. The shared style uses two spaces, 100-column wrapping, single quotes, semicolons, explicit control-flow braces and blank lines between declarations, methods and logical groups. It covers TypeScript configuration files as well as source code. See [FORMATTING.md](docs/FORMATTING.md) for the complete style and exclusions.

| Symptom                               | Check                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| Preview examples instead of real jobs | Set `DATA_MODE=postgres`, then restart the backend; terminal environment overrides `.env`   |
| Database connection fails             | Check the database process, URL, credentials and port; inspect `/health/ready` on port 3001 |
| Real catalog is empty                 | Apply migrations and run a company sync against the same database as the API                |
| API port already in use               | Stop the other project server or change `PORT`; update the Vite proxy if changing port 3001 |
| Browser cannot reach API              | Check the reverse proxy or `VITE_API_BASE_URL`, plus the exact `FRONTEND_ORIGIN` for CORS   |
| Source says awaiting audit            | A successful feed import does not verify complete employer scope                            |

## Architecture references

Start with [the documentation index](docs/README.md). Each decision reference records rationale, invariants, implementation links, and known limitations:

- [ARCHITECTURE](docs/ARCHITECTURE.md): layers, dependency direction and composition.
- [ADAPTER](docs/ADAPTER.md): provider translation and extension contract.
- [RESUME](docs/RESUME.md): deterministic analysis, review and the initial complete matching flow.
- [DOCUMENTS](docs/DOCUMENTS.md): local PDF/DOCX adapters, reading order, limits and isolation.
- [RESUME_TESTING](docs/RESUME_TESTING.md): first increment, synthetic examples and manual/automated checkpoints.
- [MATCHING](docs/MATCHING.md): requirements, explained fit, freshness and capped optional context.
- [QUALIFICATIONS](docs/QUALIFICATIONS.md): reviewed degrees, explicit skill years and bounded responsibility relevance.
- [SKILL_RELATIONS](docs/SKILL_RELATIONS.md): weighted evidence graph, confidence colors and description highlighting.
- [SEMANTICS](docs/SEMANTICS.md): implemented engineering concepts, clause interpretation and scoped skill questions.
- [SEMANTIC_MATCHING_PLAN](docs/SEMANTIC_MATCHING_PLAN.md): historical engineering roadmap; future work follows RESUME_MATCHING_REWORK.
- [RESUME_MATCHING_REWORK](docs/RESUME_MATCHING_REWORK.md): proposed semantic matching replacement, current-code findings, backend-hosted model experiments and phased acceptance gates.
- [SEMANTIC_EXPERIMENTS](docs/SEMANTIC_EXPERIMENTS.md): development evaluation, requirement algebra and local-model public-job shadow tools; live matching remains deterministic.
- [JOB_FEATURES](docs/JOB_FEATURES.md): indexed projection, backfill and hash/version invalidation.
- [RESUME_PRIVACY](docs/RESUME_PRIVACY.md): transient processing, worker CSP and private API boundaries.
- [INGESTION](docs/INGESTION.md): refresh workflow, worker and failure handling.
- [STORAGE](docs/STORAGE.md): persistence, leases, transactions and history.
- [CLASSIFICATION](docs/CLASSIFICATION.md): taxonomy, strategies and evidence.
- [LIFECYCLE](docs/LIFECYCLE.md): identity, missing jobs and quarantine.
- [HTTP](docs/HTTP.md): network policy and retries.
- [SECURITY](docs/SECURITY.md): trust boundaries and HTML preparation.
- [API](docs/API.md): public contract, query behavior and pagination.
- [ACCOUNT_BILLING_PLAN](docs/ACCOUNT_BILLING_PLAN.md): delivery plan for GitHub/LinkedIn sign-in, five free matches, US$7.95 monthly Pro, Stripe and administration; [ACCOUNTS](docs/ACCOUNTS.md) records the implemented account foundation and setup.
- [ANALYTICS_PLAN](docs/ANALYTICS_PLAN.md): proposed admin audience, registration, observed active users, funnel, retention, subscription metrics and privacy controls.
- [FRONTEND](docs/FRONTEND.md): UI state, generated client and navigation.
- [DESIGN](docs/DESIGN.md): visual tokens, locally hosted fonts, responsive layouts and interaction rules.
- [LOGOS](docs/LOGOS.md): local company logos, provenance, refresh commands and N/A fallback.
- [SOURCES](docs/SOURCES.md): registry, source audits and coverage.
- [AUDITING](docs/AUDITING.md): official-listing reconciliation, policy evidence, review gates and safe activation.
- [QUALITY](docs/QUALITY.md): code checks and verification boundaries.
- [FORMATTING](docs/FORMATTING.md): readable Prettier style, ESLint fixes and editor defaults.
- [DEPLOYMENT](docs/DEPLOYMENT.md): configuration, hosting and operations.

Full 60-company onboarding, indexed database search, classification replay, raw-payload retention and operational monitoring remain MVP follow-ups. The [account foundation](docs/ACCOUNTS.md) includes SSO and native email/password registration with optional username, verification/reset codes and a separate SMTP queue worker. Configure backend-only secrets/SMTP, apply `pnpm db:migrate`, then run `pnpm worker:email` separately; see [EMAIL_ACCOUNTS](docs/EMAIL_ACCOUNTS.md). Subscriptions/paywall/admin work remains in [ACCOUNT_BILLING_PLAN](docs/ACCOUNT_BILLING_PLAN.md). In-app job applications, paid data providers and AI classification remain outside the initial scope.

Resume matching interprets reviewed engineering activities through a 239-concept local registry. Green means full evidence, yellow partial/uncertain evidence, purple a possible unmentioned skill to confirm, and red no supported evidence. Tool usage and development are separate; answers remain temporary and require updated-profile review. See [SEMANTICS.md](docs/SEMANTICS.md) for scope and limits.

Matching now preserves job sections and logical resume evidence blocks, displaying required qualifications, preferred/nice-to-have qualifications and additional information. Comparisons retain unknown statements, OR alternatives, duration ranges, assessment coverage and evidence provenance. [MATCHING.md](docs/MATCHING.md#assessment-coverage-update-5-october-2026) defines separate fit/coverage labels and criterion-based ranking. See [STRUCTURED_MATCHING.md](docs/STRUCTURED_MATCHING.md) for the implemented stages 1-3 and [LLM_MATCHING.md](docs/LLM_MATCHING.md) for the remaining optional local-model experiment. No AI service is required to run this version.
