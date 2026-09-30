# Decision: explicit source registry and coverage

**Status:** Evidence-backed registry and coverage gates implemented; employer scope/access approvals incomplete. Recorded 30 September 2026.

## Decision and rationale

Keep employers and extraction sources separate. One company may have multiple boards, while one source entry identifies one configured provider board. Registering a company does not imply it can already be fetched.

`companies.json` records slug, name, official careers entry point and planning wave. `sources.json` records stable source ID, company slug, provider, board, `auditStatus` and `scheduled`. Configuration is validated at startup: IDs must be unique, companies must exist, boards must match the allowed identifier format, and unaudited sources cannot be scheduled.

There are currently 60 target companies and 13 candidate source boards for the first 10-company cohort, including three Discord boards discovered from its official careers script. Every source is unscheduled. Dated live observations belong in [SOURCE_CHECKS.md](SOURCE_CHECKS.md).

## Onboarding procedure

1. Follow official careers entry points and identify relevant provider boards, regional partitions and related entities.
2. Add stable candidate source entries. Preserve IDs once postings are stored; changing an ID changes posting identity.
3. Run the audit CLI and inspect official/feed identity comparisons, discovered boards, policy documents, traversal, exclusions and detail validity. It writes reports without publishing jobs or changing verification state.
4. Complete the structured scope/access review in `backend/config/source-audits.json`. Scope approval needs channel decisions and reviewed traversal; access approval needs reviewed document hashes and appropriate full-description display permission.
5. Use `audit --company <slug> --activate` only when every gate passes. Verification without valid, current configuration-bound evidence is rejected. Activation enables scheduling, but does not start the worker; validate it and restart affected processes. See [AUDITING.md](AUDITING.md) for the full procedure.

```sh
pnpm --filter @jobbely/backend run audit --company openai
```

The audit CLI preserves timestamped raw artifacts in ignored local data and updates a compact durable company report in `backend/config/audit-evidence/`. Evidence expires after 30 days. Verified refreshes repeat official reconciliation and policy checks before publishing; mismatches preserve existing listings. Durable conclusions belong in documentation as well as structured evidence.

## Coverage signals

| Status          | Current rule                                                                     |
| --------------- | -------------------------------------------------------------------------------- |
| `not_onboarded` | No configured source                                                             |
| `partial`       | Configured, but audit/success requirements not all met                           |
| `blocked`       | Any source's latest run failed                                                   |
| `stale`         | A successful complete observation is older than 36 hours                         |
| `healthy`       | Every source verified and its latest run succeeded, complete and not quarantined |
| `demo`          | Synthetic-mode override for configured companies                                 |

Company `lastCheckedAt` is the oldest successful complete check across its configured sources, and is null when any source lacks one. Latest failure takes precedence over stale/healthy signals. The directory communicates audit state rather than claiming all 60 employers are complete.

## Implementation and limits

[Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [validator](../backend/src/infrastructure/registry.ts), [coverage logic](../backend/src/application/catalog.ts), [audit CLI](../backend/src/cli/audit-source.ts).

Shared-parent boards, employer membership filters and regional partitions need explicit adapters/configuration. Registry changes are file-based and require restart; there is no source-management UI. See [ADAPTER.md](ADAPTER.md), [INGESTION.md](INGESTION.md), and [LIFECYCLE.md](LIFECYCLE.md).
