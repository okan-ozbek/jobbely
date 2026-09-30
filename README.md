# Jobbely

Jobbely collects public employer job listings, categorizes them without AI, and lets you search full descriptions and apply on the original company website.

TypeScript lives in separate `/frontend` and `/backend` packages. This first slice supports Greenhouse, Ashby and Lever. All 60 target employers are registered; three feeds have been fetched locally, and full employer coverage remains under audit. See [the MVP boundaries](MVP_PLAN.md) and [source-check evidence](docs/SOURCE_CHECKS.md).

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
   pnpm --filter @jobbely/backend run sync --company openai
   ```

   You can also sync `anthropic` and `palantir`, or another company with a configured source. These commands read the public feed and write to your configured database. An empty database shows no real listings until ingestion succeeds.

5. Start both applications:

   ```powershell
   pnpm dev
   ```

For independent development, use separate terminals:

```powershell
pnpm --filter @jobbely/backend run dev
pnpm --filter @jobbely/frontend run dev
```

The frontend development server proxies `/api` to port 3001. No frontend `.env` is needed with the default ports. Stop the servers with `Ctrl+C`; stop the Compose database with `docker compose stop`. Stopping it preserves the database volume.

## Host the application

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

Audit a configured company's provider payload without publishing listings:

```powershell
pnpm --filter @jobbely/backend run audit --company openai
```

Audit reports go to ignored `backend/data/audits/`. Provider traversal is one part of employer-scope verification. Candidate boards may be synced manually, but their missing postings cannot automatically close existing listings.

Sources in `backend/config/sources.json` are currently candidates with scheduling disabled. After verifying a source and setting `auditStatus: "verified"` and `scheduled: true`, run the separate development worker:

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

`pnpm check` runs `format:check` and `lint` without modifying files. To apply fixes, run `pnpm lint:fix` followed by `pnpm format`. The shared style uses two spaces, 100-column wrapping, single quotes, semicolons and explicit control-flow braces. It covers TypeScript configuration files as well as source code. See [FORMATTING.md](docs/FORMATTING.md) for the complete style and exclusions.

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
- [INGESTION](docs/INGESTION.md): refresh workflow, worker and failure handling.
- [STORAGE](docs/STORAGE.md): persistence, leases, transactions and history.
- [CLASSIFICATION](docs/CLASSIFICATION.md): taxonomy, strategies and evidence.
- [LIFECYCLE](docs/LIFECYCLE.md): identity, missing jobs and quarantine.
- [HTTP](docs/HTTP.md): network policy and retries.
- [SECURITY](docs/SECURITY.md): trust boundaries and HTML preparation.
- [API](docs/API.md): public contract, query behavior and pagination.
- [FRONTEND](docs/FRONTEND.md): UI state, generated client and navigation.
- [SOURCES](docs/SOURCES.md): registry, source audits and coverage.
- [QUALITY](docs/QUALITY.md): code checks and verification boundaries.
- [FORMATTING](docs/FORMATTING.md): readable Prettier style, ESLint fixes and editor defaults.
- [DEPLOYMENT](docs/DEPLOYMENT.md): configuration, hosting and operations.

Full 60-company onboarding, indexed database search, classification replay, raw-payload retention and operational monitoring remain MVP follow-ups. Accounts, in-app job applications, paid data providers and AI classification are outside the initial scope.
