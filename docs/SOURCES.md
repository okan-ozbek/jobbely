# Decision: explicit source registry and coverage

**Status:** Registry and coverage gates implemented; employer audits incomplete. Recorded 30 September 2026.

## Decision and rationale

Keep employers and extraction sources separate. One company may have multiple boards, while one source entry identifies one configured provider board. Registering a company does not imply it can already be fetched.

`companies.json` records slug, name, official careers entry point and planning wave. `sources.json` records stable source ID, company slug, provider, board, `auditStatus` and `scheduled`. Configuration is validated at startup: IDs must be unique, companies must exist, boards must match the allowed identifier format, and unaudited sources cannot be scheduled.

There are currently 60 target companies and 11 candidate source boards for the proposed first 10-company cohort. Every source is unscheduled. Dated live observations belong in [SOURCE_CHECKS.md](SOURCE_CHECKS.md).

## Onboarding procedure

1. Follow official careers entry points and identify relevant provider boards, regional partitions and related entities.
2. Add stable candidate source entries. Preserve IDs once postings are stored; changing an ID changes posting identity.
3. Run the audit CLI and inspect traversal, counts, exclusions, representative IDs/links and full descriptions. It writes reports without publishing jobs or changing verification state.
4. Compare the feed with official employer scope, document access suitability and known exclusions, and record evidence in a dated source note.
5. Mark `auditStatus: "verified"` only after the scope check. Enable scheduling separately with `scheduled: true`, validate the worker, and restart affected processes.

```sh
pnpm --filter @jobbely/backend run audit --company openai
```

The audit CLI overwrites the latest ignored report for each source ID. Promote durable conclusions into documentation; do not treat a transient raw report as permanent completeness evidence.

## Coverage signals

| Status | Current rule |
| --- | --- |
| `not_onboarded` | No configured source |
| `partial` | Configured, but audit/success requirements not all met |
| `blocked` | Any source's latest run failed |
| `stale` | A successful complete observation is older than 36 hours |
| `healthy` | Every source verified and its latest run succeeded, complete and not quarantined |
| `demo` | Synthetic-mode override for configured companies |

Company `lastCheckedAt` is the oldest successful complete check across its configured sources, and is null when any source lacks one. Latest failure takes precedence over stale/healthy signals. The directory communicates audit state rather than claiming all 60 employers are complete.

## Implementation and limits

[Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [validator](../backend/src/infrastructure/registry.ts), [coverage logic](../backend/src/application/catalog.ts), [audit CLI](../backend/src/cli/audit-source.ts).

Shared-parent boards, employer membership filters and regional partitions need explicit adapters/configuration. Registry changes are file-based and require restart; there is no source-management UI. See [ADAPTER.md](ADAPTER.md), [INGESTION.md](INGESTION.md), and [LIFECYCLE.md](LIFECYCLE.md).
