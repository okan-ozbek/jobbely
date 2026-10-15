# Jobbely

Jobbely collects public employer job listings, categorizes them without AI, and lets you search full descriptions and apply on the original company website.

Agents should start with [AGENTS.md](AGENTS.md) for repository boundaries, documentation references and required completion checks.

The [500-company technology employer backlog](docs/TECH_COMPANIES_500.md) proposes future integrations by sector, with existing registry status, discovery links and an ordered onboarding queue. It is a planning shortlist; each employer still needs source discovery and coverage/access checks before activation.

The **Resume** page reads text or a local PDF/DOCX, shows reading order and claims, and lets you correct the profile before requesting explained job recommendations. It covers engineering, data/AI, product, sales and people, with explicit gaps, uncertainty and freshness. Candidate data stays transient; only public job features are persisted. Try the synthetic examples in [RESUME_TESTING](docs/RESUME_TESTING.md); see [RESUME_PLAN](RESUME_PLAN.md) for broader follow-ups.

Scheduled sources refresh one by one in the order in [refresh-order.json](backend/config/refresh-order.json), at startup and 00:00/12:00 UTC. Blocked feeds still fail explicitly; audit and closure gates remain separate. See [ingestion](docs/INGESTION.md) and [performance](docs/PERFORMANCE.md).

TypeScript lives in separate `/frontend` and `/backend` packages. [PROVIDERS](docs/PROVIDERS.md) summarizes supported integrations; the registry and source run reports establish current availability.

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
   docker compose up -d --wait postgres
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
   pnpm sync --all-enabled
   ```

   This imports every scheduled source in the configured company order. Large boards can take hours because complete detail retrieval retains host pacing. Failed/restricted sources produce a nonzero exit code while other sources continue. For a quick targeted import use `pnpm sync --company openai`. An empty database shows no real listings until ingestion succeeds.

5. Start both applications:

   ```powershell
   pnpm dev
   ```

See [PROVIDERS](docs/PROVIDERS.md) for traversal/access limits and [SOURCE_CHECKS](docs/SOURCE_CHECKS.md) for dated full-import evidence. Unconfigured companies need a real supported source before they can be fetched.

For independent development, use separate terminals:

```powershell
pnpm --filter @jobbely/backend run dev
pnpm --filter @jobbely/frontend run dev
```

The frontend development server proxies `/api` to port 3001. No frontend `.env` is needed with the default ports. Stop the servers with `Ctrl+C`; stop the Compose database with `docker compose stop`. Stopping it preserves the database volume.

### Personal Codex resume-review test

With the installed Codex CLI signed in through ChatGPT, run this from a fresh PowerShell terminal. It uses Sol 6.1 for opted-in writing feedback and enables the existing temporary Pro preview for signed-in accounts:

```powershell
$env:RESUME_REVIEW_PROVIDER = "codex-local"
$env:RESUME_REVIEW_MODEL = "gpt-6.1-sol"
$env:RESUME_REVIEW_CODEX_COMMAND = (Get-Command codex -CommandType Application).Source
$env:TEMPORARY_PRO_ACCESS = "true"
pnpm dev
```

Open **http://127.0.0.1:5173/?view=resume**, sign in, and select **Include AI writing feedback** before reviewing. This starts a separate ephemeral CLI session; it does not reuse this chat's history. It sends minimized text to OpenAI using your signed-in account and its usage/data controls. The CLI must support the isolation flags tested by the adapter. This provider rejects production and non-loopback configurations; use the API provider for a hosted application. See [RESUME_REVIEWER](docs/RESUME_REVIEWER.md#personal-local-codex-provider) for the limits and verification.

## Host the application

### Run the app in Docker

Docker can run the built frontend, API, migration job and PostgreSQL together:

```powershell
docker compose up -d --build --wait
```

Open **http://127.0.0.1:8080/**. Port 8080 keeps this stack separate from `pnpm dev`
on 5173. The existing PostgreSQL volume is reused. The API has no published port;
the frontend proxies `/api` under the same origin. PDF/DOCX parsing still happens
locally in the browser, served as a bundled worker with the required isolation headers.

Start optional workers and the localhost database browser independently:

```powershell
docker compose --profile ingestion up -d --scale ingestion-worker=4 ingestion-worker
docker compose --profile email up -d email-worker

docker compose --profile tools up -d db-browser
```

The email worker requires `AUTH_CODE_SECRET`, `SMTP_HOST` and `SMTP_FROM` in
`backend/.env`; API and email worker receive the same secret. Ingestion shares company jobs across replicas with automatic audits on startup and twice daily. Progress and
evidence persist in `ingestion-data`; candidate sources remain partial. See
[INGESTION.md](docs/INGESTION.md). To start both workers with the app after configuration:

```powershell
docker compose --profile ingestion --profile email up -d --build --wait
```

Open [Adminer](http://127.0.0.1:8082/) to browse/query the existing database; [login and SQL examples](docs/DOCKER.md#database-browser) use the Compose development account. Change the `--scale ingestion-worker=4` value to adjust worker count.

See [DOCKER.md](docs/DOCKER.md) for configuration, logs, refresh commands and restart
steps. Stop with `docker compose --profile ingestion --profile email stop`; this
preserves the database. Use the explicit `postgres` service when you want only the
database for host-side development.

### Deploy to a host

For an existing PostgreSQL installation, apply `pnpm db:migrate`, then `pnpm features:backfill` before matching. Demo listings are excluded. Production PDF/DOCX reading requires the worker CSP headers in [DEPLOYMENT](docs/DEPLOYMENT.md); missing headers preserve pasted-text fallback.

Host the built frontend as static files, run the backend as a persistent Node process, and provide PostgreSQL. Use a reverse proxy to serve the frontend and route `/api/` to the backend under the same HTTPS origin.

| Component                      | Build/output                                            | Runtime                                              |
| ------------------------------ | ------------------------------------------------------- | ---------------------------------------------------- |
| Frontend                       | `frontend/dist/`                                        | Static hosting or reverse proxy                      |
| API                            | `backend/dist/` plus `backend/config/` and dependencies | `pnpm --filter @jobbely/backend run start`           |
| Database                       | Versioned Prisma migrations                             | PostgreSQL with persistent storage                   |
| Ingestion worker, when enabled | Same backend build/config                               | From `backend/`: `node dist/worker/main.js`          |
| Email worker, when configured  | Same backend build/config and SMTP secrets              | From `backend/`: `node dist/worker/account-email.js` |

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

Refresh all scheduled sources with `pnpm sync --all-enabled`, or enqueue the audited background cycle with `pnpm sync:refresh`. Choose exactly one manual selector: `--company <slug>` (all company boards, including disabled) or `--all-enabled` (scheduled sources only). A failed source is reported without abandoning later sources; failures set a nonzero exit code. Imports do not approve coverage or change scheduling.

Audit a company's official listings, hiring channels, policy evidence and provider feeds without publishing listings:

```powershell
pnpm --filter @jobbely/backend run audit --company openai
pnpm --filter @jobbely/backend audit --all-enabled
```

Raw audit evidence goes to ignored, timestamped `backend/data/audits/` directories; compact reports go to `backend/config/audit-evidence/`. Audits compare posting IDs, flag new boards, capture policy documents and require recorded scope/access approvals. See [AUDITING.md](docs/AUDITING.md) for review and activation commands. Candidate boards may be synced manually, but their missing postings cannot automatically close existing listings.

Scheduling and verification are independent. Candidate sources may be scheduled while access/display and absence-based closure remain gated. `audit --company <slug> --activate` still requires current complete approval evidence. Restart affected processes after registry changes.

The **Coverage verified** badge now uses [automatic technical assessments](docs/AUTOMATIC_COVERAGE.md), independently of those legacy activation flags. The ingestion worker grants/revokes it from official-inventory matching, supported pagination and fresh imported runs, without manual approval or restart. Access/display review and absence-based closure remain separate policies.

```powershell
pnpm --filter @jobbely/backend run worker
```

The worker has one ordered scheduling policy and audits each employer automatically. `pnpm sync:refresh` requests a cycle through the shared exclusive queue. See [INGESTION](docs/INGESTION.md) for order, progress, retries and upgrade steps. The API does not start the worker.

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

- [RANKED_SYNC_PLAN](docs/PERFORMANCE.md): proposed financial-size ranking, parallel round-robin company sync and retirement of waves.
- [RESUME_PERFORMANCE_PLAN](docs/PERFORMANCE.md): measured local query/freshness problems and a phased plan for usable analysis and scalable matching.

- [ARCHITECTURE](docs/ARCHITECTURE.md): layers, dependency direction and composition.
- [ADAPTER](docs/ADAPTER.md): provider translation and extension contract.
- [RESUME](docs/RESUME.md): deterministic analysis, review and the initial complete matching flow.
- [RESUME_REVIEWER](docs/RESUME_REVIEWER.md): paid mistake checks, opt-in API writing feedback and a personal localhost Codex provider, with production entitlement/model launch gates.
- [ROLE_ASSESSMENT](docs/ROLE_ASSESSMENT.md): opt-in Pro ATS keyword/recruiter evidence alignment, grounded quotations and qualitative confidence, separate from deterministic matching.
- [DOCUMENTS](docs/DOCUMENTS.md): local PDF/DOCX adapters, reading order, limits and isolation.
- [RESUME_TESTING](docs/RESUME_TESTING.md): first increment, synthetic examples and manual/automated checkpoints.
- [MATCHING](docs/MATCHING.md): requirements, explained fit, freshness and capped optional context.
- [QUALIFICATIONS](docs/QUALIFICATIONS.md): reviewed degrees, explicit skill years and bounded responsibility relevance.
- [SKILL_RELATIONS](docs/SKILL_RELATIONS.md): weighted evidence graph, confidence colors and description highlighting.
- [SEMANTICS](docs/SEMANTICS.md): implemented engineering concepts, clause interpretation and scoped skill questions.
- [SEMANTIC_MATCHING_PLAN](docs/RESUME_MATCHING_REWORK.md): historical engineering roadmap; future work follows RESUME_MATCHING_REWORK.
- [RESUME_MATCHING_REWORK](docs/RESUME_MATCHING_REWORK.md): proposed semantic matching replacement, current-code findings, backend-hosted model experiments and phased acceptance gates.
- [ATS_QUALITY_PLAN](docs/ATS_QUALITY_PLAN.md): reproduced Airbnb matching failure, rules/NLP/model options, independent quality benchmarks and proposed release gates.
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
- [BILLING_TEST](docs/BILLING_TEST.md): account settings, monthly/quarterly/yearly pricing and Stripe sandbox checkout. Set the backend test secret, run `pnpm billing:setup:test` and restart the API when ready to test; live billing and paid access remain pending.
- [ANALYTICS_PLAN](docs/ANALYTICS_PLAN.md): proposed admin audience, registration, observed active users, funnel, retention, subscription metrics and privacy controls.
- [FRONTEND](docs/FRONTEND.md): UI state, generated client and navigation.
- [DESIGN](docs/DESIGN.md): visual tokens, locally hosted fonts, responsive layouts and interaction rules.
- [LOGOS](docs/LOGOS.md): local company logos, provenance, refresh commands and N/A fallback.
- [SOURCES](docs/SOURCES.md): registry, source audits and coverage.
- [AUDITING](docs/AUDITING.md): official-listing reconciliation, policy evidence, review gates and safe activation.
- [QUALITY](docs/QUALITY.md): code checks and verification boundaries.
- [FORMATTING](docs/FORMATTING.md): readable Prettier style, ESLint fixes and editor defaults.
- [DEPLOYMENT](docs/DEPLOYMENT.md): configuration, hosting and operations.

Full 60-company onboarding, indexed database search, classification replay, raw-payload retention and operational monitoring remain MVP follow-ups. The [account foundation](docs/ACCOUNTS.md) includes SSO and native email/password registration with verification/reset codes, permanent account deletion and a separate SMTP queue worker. Configure backend-only secrets/SMTP, apply `pnpm db:migrate`, then run `pnpm worker:email` separately; see [EMAIL_ACCOUNTS](docs/EMAIL_ACCOUNTS.md). Subscriptions/paywall/admin work remains in [ACCOUNT_BILLING_PLAN](docs/ACCOUNT_BILLING_PLAN.md). In-app job applications, paid data providers and AI classification remain outside the initial scope.

Resume matching interprets reviewed engineering activities through a 239-concept local registry. Green means full evidence, yellow partial/uncertain evidence, purple a possible unmentioned skill to confirm, and red no supported evidence. Tool usage and development are separate; answers remain temporary and require updated-profile review. See [SEMANTICS.md](docs/SEMANTICS.md) for scope and limits.

Matching now preserves job sections and logical resume evidence blocks, displaying required qualifications, preferred/nice-to-have qualifications and additional information. Comparisons retain unknown statements, OR alternatives, duration ranges, assessment coverage and evidence provenance. [MATCHING.md](docs/MATCHING.md#assessment-coverage-update-5-october-2026) defines separate fit/coverage labels and criterion-based ranking. See [STRUCTURED_MATCHING.md](docs/STRUCTURED_MATCHING.md) for the implemented stages 1-3 and [RESUME_MATCHING_REWORK.md](docs/RESUME_MATCHING_REWORK.md) for the remaining optional local-model experiment. No AI service is required to run this version.
