# Jobbely

TypeScript job extraction with separate `/backend` and `/frontend` packages. This is the first working implementation slice of [the MVP plan](MVP_PLAN.md), using public ATS APIs and deterministic classification with zero runtime AI.

The current slice includes Greenhouse, Ashby and Lever adapters, PostgreSQL storage, a read-only Fastify API, and a React interface with search, filters, full descriptions, original application links and company coverage. All 60 requested employers are registered. Eleven candidate boards cover the proposed initial 10-company cohort; they remain unscheduled until their employer scope is audited. Three sources have been fetched successfully into the local development database.

## Architecture

Read [the architecture decisions](docs/ARCHITECTURE.md) for dependency rules and pattern responsibilities. Source adapters translate provider data; classification strategies consolidate native labels into a canonical taxonomy. Application use cases own the refresh workflow, domain functions own lifecycle rules, and repository transactions own publication. The frontend consumes a generated OpenAPI contract.

```text
backend/
  config/                 Company and candidate source registry
  prisma/                 Database schema and versioned migration
  src/
    domain/               Pure models, categorization and lifecycle policies
    ports/                Adapter, transport and repository contracts
    application/          Refresh and catalog use cases
    infrastructure/       ATS APIs, HTTP, HTML and storage implementations
    api/                  Public validation and routes
    cli/                  Operator audit, sync and contract commands
    worker/               Scheduled ingestion entry point
frontend/
  src/api/                Generated contract and typed API client
  src/                    React interface and styles
contracts/openapi.json    Public interface shared across the packages
docs/                     Architecture and source audit evidence
```

## Run locally

Use Node.js 24 and the pnpm version declared in `package.json`. From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
```

Without `backend/.env`, the backend runs an explicitly labeled synthetic demo. The frontend is at `http://127.0.0.1:5173`; the backend listens on `http://127.0.0.1:3001`. Demo mode does not perform extraction.

For persistent mode, provision PostgreSQL, then copy `backend/.env.example` to `backend/.env`, set `DATA_MODE=postgres`, and provide its `DATABASE_URL`. The included Compose file provides a local PostgreSQL 17 database:

```powershell
docker compose up -d
pnpm db:migrate
pnpm --filter @jobbely/backend run sync --company openai
pnpm --filter @jobbely/backend run sync --company anthropic
pnpm --filter @jobbely/backend run sync --company palantir
pnpm dev
```

During this implementation, a project-local PostgreSQL 18 cluster was provisioned under ignored `backend/data/` because Docker was unavailable. The existing ignored `.env` points to that running cluster on port 55432. Its binaries, credentials and database are development artifacts, not dependencies of the application or portable setup instructions; Compose remains the reproducible standard setup.

Stop the development servers before switching modes or database configuration. A failed persistent database connection does not fall back to demo data.

## Audit and enable a source

```powershell
pnpm --filter @jobbely/backend run audit --company openai
```

This retrieves the public feed and records traversal/payload evidence under ignored `backend/data/audits/`. It does not establish full employer coverage or automatically enable scheduling. Compare the source with official careers entry points, regional boards, counts and representative details before marking its scope verified in `backend/config/sources.json`.

Once a source is verified and explicitly enabled, run the separate worker:

```powershell
pnpm --filter @jobbely/backend run worker
```

The worker uses PostgreSQL-backed scheduling; candidate sources are rejected. Manual sync of candidate sources supports evaluation, but absence-based closure remains disabled for them. Verified sources require two complete missing observations at least 24 hours apart; large count drops quarantine removals.

## Quality checks

```powershell
pnpm check
```

This checks layer boundaries, lint, strict types, unit/API tests, generated contracts and both builds. PostgreSQL integration tests run when `TEST_DATABASE_URL` points to a dedicated database whose name starts with `jobbely_test_`; they are explicitly skipped otherwise. They create the initial schema if needed and use unique test sources without deleting existing data. Never use an application database for this variable.

Validation for this slice: 35 passing tests including four against real PostgreSQL; live payload/traversal checks for OpenAI, Anthropic and Palantir; browser checks of search, filtering, details and company coverage. See [the source checks](docs/SOURCE_CHECKS.md) for evidence and limits.

## Remaining MVP work

- Audit the remaining initial boards and verify employer/region scope for every enabled company.
- Validate scheduled worker retries and recovery before turning on unattended ingestion.
- Move catalog filtering, sorting and pagination into indexed PostgreSQL queries. The first slice reads a consistent dataset into memory, so it is suitable for initial integration but requires this change for broad ingestion.
- Add company-specific category overrides and a classification replay command; retain the existing deterministic fallback and evidence.
- Establish raw payload retention, deployment configuration and operational monitoring.
- Expand adapters and source audits to the remaining 50 target companies as specified in the plan.

Accounts, applications submitted inside Jobbely, paid data providers and AI classification are outside the initial scope.
