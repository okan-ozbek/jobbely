# Decision: separate Docker services

**Status:** Implemented 6 October 2026, Europe/Amsterdam; local verification described below. This is a local deployment stack, not a hardened public production deployment.

## Choice and rationale

Use one shared backend image with separate API, migration, ingestion and account-email processes, plus a static Nginx frontend and PostgreSQL. Separate services allow workers to restart and scale without restarting the API. PostgreSQL owns both durable queues; no Redis service is required by the current implementation.

The document parser remains a local browser worker. Moving candidate files into a backend container would change the privacy boundary and require a separate upload/isolation design. Nginx instead serves the self-contained production parser with strict CSP on HEAD and GET, no-store and nosniff. Missing assets return 404 rather than the application HTML. This avoids dependence on development module loading and supplies headers that arbitrary static hosts may omit. It does not claim every damaged or unsupported document can be parsed.

## Services and invariants

| Service            | Behavior                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `postgres`         | Existing PostgreSQL 17 database and persistent `postgres-data` volume; loopback port 5432             |
| `migrate`          | One-shot `prisma migrate deploy`; must succeed before API/workers start                               |
| `api`              | Compiled Node 24 backend, readiness check, no published port                                          |
| `web`              | Nginx frontend and same-origin `/api` proxy at loopback port 8080                                     |
| `ingestion-worker` | Optional `ingestion` profile; ordered A/B/C refresh, automatic audits and matching-feature projection |
| `email-worker`     | Optional `email` profile; encrypted account-email outbox, leases/retries and SMTP delivery            |

API and workers run as the non-root Node user with an init process and a 45-second shutdown grace period. API readiness checks the database. Worker restart supervision does not prove successful ingestion or email delivery: inspect logs and persisted run/queue states. Workers retain their existing concurrency and security policies.

The frontend proxy resolves the API through Docker DNS with a ten-second validity window, so an API container recreation can recover without restarting Nginx. Requests during an API restart may fail briefly; the proxy does not automatically replay private POST operations.

Builds use Node 24, pnpm 12.6.0 and the frozen workspace lockfile. The backend image retains Prisma CLI/build dependencies so migrations run from the same release; further image minimization is deferred. `.dockerignore` excludes local configuration/secrets, database data, generated host dependencies, logs, test output and PDF/Word files. No environment file is baked into images. The frontend image contains only static build output and Nginx configuration.

## Configuration and commands

From the repository root, with Docker Desktop running:

```powershell
docker compose config --quiet
docker compose up -d --build --wait
```

Open [the Docker app](http://127.0.0.1:8080/). This works without host Node/pnpm. An empty database initially has no public listings; startup does not import feeds or invent examples. Existing listings/volumes are preserved. `docker compose up -d --wait postgres` continues to support host-side `pnpm dev`.

Compose optionally reads `backend/.env` at runtime for backend-only OAuth, SMTP, `AUTH_CODE_SECRET` and `MATCH_CURSOR_SECRET` values. It overrides mode, host, port, database URL and frontend origin for the internal Docker network. This stack intentionally uses its bundled local database; use a reviewed deployment override for a hosted database and credentials. Never print resolved Compose configuration containing secrets.

Email registration requires the shared stable `AUTH_CODE_SECRET`. Delivery additionally requires SMTP configuration from [EMAIL_ACCOUNTS](EMAIL_ACCOUNTS.md). Set the same secret on API and email replicas; do not rotate it casually while encrypted outbox jobs exist. External SMTP keeps required STARTTLS or implicit TLS. `localhost` inside a container refers to that container: prefer an external SMTP hostname. The existing insecure development exception only accepts literal loopback; `host.docker.internal` is not an allowed plaintext SMTP exception. No mail provider or credentials are provisioned automatically.

```powershell
docker compose --profile ingestion up -d ingestion-worker
docker compose --profile email up -d email-worker
# Or, once email is configured:
docker compose --profile ingestion --profile email up -d --build --wait
docker compose ps -a
docker compose logs --tail 50 api ingestion-worker email-worker
```

Missing email settings fail worker startup explicitly. Since 6 October, ingestion automatically requests an ordered A/B/C sync and audit cycle on startup and twice daily; [WAVE_REFRESH.md](WAVE_REFRESH.md) explains progress reports and failure handling. Candidate sources stay partial and cannot reconcile closure. Starting the worker does not establish employer coverage or source activation. Audit/progress files persist in the `ingestion-data` volume. Run a manual refresh or feature backfill inside the same backend image:

```powershell
docker compose exec api node dist/cli/sync.js --company openai
docker compose exec api node dist/cli/backfill-features.js
```

After changing `backend/.env`, recreate the affected services:

```powershell
docker compose up -d --force-recreate api
docker compose --profile email up -d --force-recreate email-worker
```

To use another browser port, set both published port and the exact public origin:

```powershell
$env:JOBBELY_PORT = '8081'
$env:JOBBELY_ORIGIN = 'http://127.0.0.1:8081'
docker compose up -d --force-recreate api web
```

OAuth callbacks must use that origin and `/api/v1/auth/{github|linkedin}/callback`. Changing origin also changes the browser cookie boundary; reauthenticate. Local HTTP is supported only on literal loopback. Public deployments need HTTPS, hosted secrets, database credentials/backups, edge admission limits and the other [DEPLOYMENT](DEPLOYMENT.md) gates.

Stop without deleting data:

```powershell
docker compose --profile ingestion --profile email stop
```

For upgrades, rebuild/start with the same command; the migration job applies additive pending migrations. Review migration compatibility and back up first. Never use `down -v` as an upgrade or normal restart operation. Older application images and database recovery are separate rollback concerns.

## Implementation and verification

[Dockerfile](../Dockerfile), [build exclusions](../.dockerignore), [Compose](../compose.yaml), [Nginx](../docker/nginx.conf), [API](../backend/src/main.ts), [ingestion](../backend/src/worker/main.ts), [email](../backend/src/worker/account-email.ts), [document isolation](RESUME_PRIVACY.md).

Verification includes Compose configuration validation, actual image builds/startup, database migrations/readiness, frontend/API routing, parser HEAD/GET headers and synthetic PDF/DOCX extraction in development and the container-hosted browser. Live external SMTP delivery and enabled-source full imports remain separate checks requiring configuration and source evidence. Unit tests alone do not establish container behavior.

On 6 October 2026, both images built and the app ran locally at port 8080 using the existing PostgreSQL volume. Migrations exited successfully, API/web/database reported healthy, and ingestion reported ready with no currently enabled sources. Nginx configuration validation passed; parser HEAD/GET returned the strict CSP, JavaScript MIME type and no-store; a missing parser returned 404. Image checks found no backend/frontend environment files or local database directory. Synthetic PDF and DOCX selection enabled resume review in both development and Docker hosting; DOCX review reached backend profile analysis. The intermittent startup error reported by the user was not reproduced with these synthetic documents, so its specific cause remains unconfirmed.

The actual email-worker container started and handled SIGTERM against an isolated `jobbely_test_docker` database with synthetic configuration and an empty queue. No external email was sent; live SMTP configuration is still required to enable the normal email service. Root `pnpm check` passed formatting, dependency boundaries, logo validation, zero-warning lint, strict types, contracts, production builds and all 638 tests (603 backend, 35 frontend), including 25 PostgreSQL tests against the isolated `jobbely_test_accounts` database.

References: [Compose profiles](https://docs.docker.com/reference/compose-file/profiles/), [service startup dependencies](https://docs.docker.com/reference/compose-file/services/#depends_on), [Nginx proxy resolution](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass).
