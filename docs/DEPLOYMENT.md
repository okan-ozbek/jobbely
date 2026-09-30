# Decision and guide: local runtime and hosting

**Status:** Local runtime implemented. Hosting topology is documented but has not been deployed or load-tested. Recorded 30 September 2026.

## Decision and rationale

Deploy a static frontend, a persistent Node API process, PostgreSQL, and an optional separate Node ingestion worker. Keep the code as one workspace with separate packages/processes; this avoids introducing distributed service infrastructure before it is needed. The database survives releases, and API requests remain independent of upstream job boards.

Prefer one public HTTPS origin with `/api/` routed to the API. This preserves the default relative API URLs and reduces configuration. Separate frontend/API origins are supported through an explicit frontend build input and backend CORS origin.

```mermaid
flowchart LR
  Browser[Browser] --> Edge[HTTPS hosting / reverse proxy]
  Edge --> Static[frontend/dist static files]
  Edge --> API[Node API]
  API --> DB[(PostgreSQL)]
  Worker[Optional Node worker] --> DB
  Worker --> ATS[Public ATS APIs]
  Operator[Operator sync CLI] --> DB
  Operator --> ATS
```

See [the root README](../README.md) for the PowerShell local setup. Local PostgreSQL Compose uses development credentials and is not a production database recipe.

## Configuration reference

| Variable            | Consumer                            | Current default / required value                                                                                  |
| ------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATA_MODE`         | API, sync, worker                   | Defaults to `demo`; use `postgres` for real stored jobs; sync/worker require it                                   |
| `DATABASE_URL`      | Prisma migration, API, sync, worker | Required at application startup in PostgreSQL mode; provide the actual hosted connection string                   |
| `HOST`              | API                                 | `127.0.0.1`; use `0.0.0.0` inside a managed service/container when its private ingress needs to reach the process |
| `PORT`              | API                                 | `3001`; honor the hosting service's supplied port                                                                 |
| `FRONTEND_ORIGIN`   | API CORS                            | `http://127.0.0.1:5173`; set the exact public frontend origin, such as `https://jobs.example.com`                 |
| `VITE_API_BASE_URL` | Frontend build                      | Empty for same-origin `/api`; public API origin for separate hosting                                              |
| `TEST_DATABASE_URL` | Backend integration tests           | Optional dedicated `jobbely_test_*` database; unrelated to application storage                                    |

The backend uses `dotenv/config`: it loads `.env` from the process working directory, and existing process environment values take precedence. Root `pnpm --filter @jobbely/backend ...` commands run in the backend package, making `backend/.env` the local configuration file. Direct compiled commands must likewise run from `backend/` if relying on that file.

For production, inject variables through the host's environment/secret configuration rather than copying a developer's `.env`. `NODE_ENV=production` may be set conventionally, but it does not select `DATA_MODE`. Prisma's migration config has a local URL fallback; explicitly supply the hosted `DATABASE_URL` so a release cannot accidentally target the development database.

Vite exposes `VITE_*` values in the browser bundle and replaces them during builds. Changing a running server's environment cannot update an existing static bundle. Never put database credentials or private keys in frontend variables. [Vite environment documentation](https://vite.dev/guide/env-and-mode.html).

## Deployment recipe

### 1. Prepare persistent storage

Provision a private PostgreSQL database with persistent storage and backups. PostgreSQL 17 is the local Compose baseline; initial integration testing also used PostgreSQL 18. Configure the connection's TLS settings according to your database host's requirements, without disabling certificate checks as a workaround.

The API and worker connect to the same application database. The worker additionally creates/manages pg-boss queue tables; its database role needs the relevant schema permissions. Keep the database port inaccessible from the public browser network.

### 2. Build a release

Use Node.js 24 and the pnpm version declared in `package.json`. Check out/install on the target operating system or its build environment. Retain build-time dependencies during this baseline workflow; client generation and contract export require them.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` includes the production build. If checks run separately in CI, build the release with `pnpm build`. No live database is needed for code compilation or contract export. PostgreSQL tests run only when their separate test connection is supplied.

Release outputs are `frontend/dist/` and `backend/dist/`. The API also needs `backend/config/`, package manifests, and its installed dependencies. Prisma's generated client is compiled into the backend output. Deploy the full workspace/dependency layout for this initial recipe, or create and verify a dedicated runtime artifact before pruning it. Copying `backend/dist/` alone is insufficient.

Keep `VITE_API_BASE_URL` empty for the default single-origin setup. If a reused build environment already sets it, clear or override it before building.

### 3. Apply migrations once

Inject the target database connection into the release job, then run from the repository root:

```sh
pnpm db:migrate
```

This executes committed Prisma migrations. Run it as a release step rather than independently in every API replica. Back up before a schema upgrade; inspect new migrations for compatibility with both the preceding and new application release.

### 4. Start the API

Configure runtime variables through your process manager or hosting service:

```dotenv
DATA_MODE=postgres
DATABASE_URL=postgresql://USER:PASSWORD@PRIVATE_DB_HOST:5432/jobbely
HOST=127.0.0.1
PORT=3001
FRONTEND_ORIGIN=https://jobs.example.com
NODE_ENV=production
```

The URL above is a placeholder. Use the real secret connection string and any required TLS parameters. For a managed service/container whose ingress connects across a private network interface, set `HOST=0.0.0.0`; for the same-host reverse proxy example below, keep loopback binding.

Start from the root:

```sh
pnpm --filter @jobbely/backend run start
```

Equivalent compiled command, from `backend/`:

```sh
node dist/main.js
```

Use an always-on Node service or process supervisor with restart-on-failure, captured stdout/stderr, and graceful termination. SIGINT/SIGTERM close the API and repository. Verify `/health/live` and `/health/ready` on the API's private address; readiness checks database connectivity, not employer coverage or ingestion freshness.

### 5. Serve the frontend and route requests

Publish `frontend/dist/` through your static host or reverse proxy. Serve at the domain root with the current Vite base configuration. Preserve the query string and configure an SPA fallback to `index.html` for frontend navigation. Vite's development server and `vite preview` are development/build-preview tools; production uses static hosting. [Vite static deployment documentation](https://vite.dev/guide/static-deploy.html).

For a Linux host with both processes on the same machine, this Nginx server block illustrates routing **behind an HTTPS-terminating edge** that forwards to port 8080. If Nginx is the public edge itself, configure its TLS listener/certificate and HTTP-to-HTTPS redirect using your hosting setup before exposing it.

```nginx
server {
    listen 127.0.0.1:8080;
    server_name jobs.example.com;
    root /srv/jobbely/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /health/ {
        proxy_pass http://127.0.0.1:3001;
    }

    location /logos/ {
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Replace the domain/root with the actual release location. `proxy_pass` deliberately has no trailing URI so `/api/v1/...` reaches Fastify unchanged. Health routes are handled before the SPA fallback. If the edge runs on another machine, use private-network listener/upstream addresses instead of loopback. Validate routing with your host's configuration tools before enabling it. [Nginx proxy URI behavior](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass), [Nginx file fallback](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files).

The build copies local company logos into `frontend/dist/logos/`. Include them in each static release and serve missing `/logos/` paths as 404 rather than applying the SPA fallback. The browser uses the frontend origin for these paths, including when the API is hosted separately. See [LOGOS.md](LOGOS.md).

### 6. Populate listings and optionally run the worker

An empty database has no real jobs. Run an operator import from the root:

```sh
pnpm --filter @jobbely/backend exec node dist/cli/sync.js --company openai
```

This writes into the configured application database. A manual import of a candidate source does not verify employer scope or enable closure.

After scope audits and worker recovery validation, enable the intended verified sources in the registry and run a separate supervised process, from `backend/`:

```sh
node dist/worker/main.js
```

Give it the same database/environment and configuration release as the API. Keep it alive to consume schedules. The API's start command does not start ingestion. All sources are currently disabled for scheduling; starting the worker alone will not create live refreshes. Source disablement should also reconcile previously stored queue schedules before unattended operation; that administrative workflow remains pending.

## Hosting frontend and API separately

For example, a static origin `https://jobs.example.com` and a persistent API origin `https://api.jobs.example.com`:

1. Set `VITE_API_BASE_URL=https://api.jobs.example.com` in the frontend build environment. Do not append `/api/v1`; the typed client supplies route paths.
2. Build and publish `frontend/dist/`.
3. Set the API's `FRONTEND_ORIGIN=https://jobs.example.com`, without a trailing slash/path, then restart the API.
4. Verify the browser can load listings and details under HTTPS, including CORS responses.

The Vite development proxy is not included in static build output. A static-only host cannot run this backend/worker; provision persistent Node hosting alongside the static site. The current application has no serverless deployment adapter.

## Release verification and upgrades

Confirm private API readiness, public frontend assets, `/api/v1/jobs` JSON routing, a detail/application link, and company coverage. Check a successful import's run record and counts. `demo` or `partial` is not evidence of live complete coverage. Review database backups, log capture and resource limits for the target environment.

For updates, build a new release, review/apply compatible migrations once, replace static assets and restart API/worker processes. Preserve PostgreSQL and the stable source registry IDs. Keep the previous release for application rollback; a database migration may require a separate recovery plan. Do not reset schemas or delete database volumes as a deployment step.

Current limits include application-memory catalog queries, global publication serialization, no raw-data retention cleanup, no application-level API rate limiter, and incomplete worker/source audits. Hosting instructions do not remove those limits. See [STORAGE.md](STORAGE.md), [INGESTION.md](INGESTION.md), [SECURITY.md](SECURITY.md), and [QUALITY.md](QUALITY.md).

## Implementation references

[Workspace scripts](../package.json), [backend commands](../backend/package.json), [bootstrap](../backend/src/bootstrap.ts), [API entry point](../backend/src/main.ts), [worker entry point](../backend/src/worker/main.ts), [frontend build config](../frontend/vite.config.ts), [migration config](../backend/prisma.config.ts), [local Compose](../compose.yaml), [backend environment example](../backend/.env.example), [frontend environment example](../frontend/.env.example).
