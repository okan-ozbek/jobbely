# Decision: explicit source registry and coverage

**Status:** Evidence-backed registry and coverage gates implemented; employer scope/access approvals incomplete. Recorded 30 September 2026.

## Decision and rationale

Keep employers and extraction sources separate. One company may have multiple boards, while one source entry identifies one configured provider board. Registering a company does not imply it can already be fetched.

`companies.json` records slug, name, official careers entry point and historical cohort metadata. `sources.json` records stable source ID, company slug, provider, board, `auditStatus` and `scheduled`. Configuration is validated at startup: IDs must be unique, companies must exist, boards must match the allowed identifier format, and verified sources require valid audit evidence. Since the explicit 6 October application-owner request, candidates can be scheduled independently of verification; access/publication and closure gates remain separate. See [INGESTION.md](INGESTION.md).

Use [companies.json](../backend/config/companies.json) and [sources.json](../backend/config/sources.json) for the current inventory. [refresh-order.json](../backend/config/refresh-order.json) controls priority independently of historical cohorts. Restricted or unusable sources still fail explicitly; dated observations live in [SOURCE_CHECKS](SOURCE_CHECKS.md).

## Onboarding procedure

1. Follow official careers entry points and identify relevant provider boards, regional partitions and related entities.
2. Add stable candidate source entries. Preserve IDs once postings are stored; changing an ID changes posting identity.
3. Run the audit CLI and inspect official/feed identity comparisons, discovered boards, policy documents, traversal, exclusions and detail validity. It writes reports without publishing jobs or changing verification state.
4. Complete the structured scope/access review in `backend/config/source-audits.json`. Scope approval needs channel decisions and reviewed traversal; access approval needs reviewed document hashes and appropriate full-description display permission.
5. Use `audit --company <slug> --activate` only when every gate passes. Verification without valid, current configuration-bound evidence is rejected. Traditional activation grants verified status and also enables scheduling, but scheduling alone no longer requires activation and does not start the worker; validate it and restart affected processes. See [AUDITING.md](AUDITING.md) for the full procedure.

```sh
pnpm --filter @jobbely/backend run audit --company openai
```

The audit CLI preserves timestamped raw artifacts in ignored local data and updates a compact durable company report in `backend/config/audit-evidence/`. Evidence expires after 30 days. Verified refreshes repeat official reconciliation and policy checks before publishing; mismatches preserve existing listings. Durable conclusions belong in documentation as well as structured evidence.

## Coverage signals

Since 6 October, [AUTOMATIC_COVERAGE.md](AUTOMATIC_COVERAGE.md) supersedes manual verification for the coverage badge. The worker publishes technical assessments to PostgreSQL, and the API grants or withdraws **Coverage verified** automatically from current configuration-bound evidence and exact imported runs. Candidate registry flags do not prevent a passing technical checkmark; access approval and absence-based closure keep their separate gates. The older activation procedure above remains available for those stronger policies.

| Status          | Current rule                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `not_onboarded` | No configured source                                                                                                                                                |
| `partial`       | Configured, but audit/success requirements not all met                                                                                                              |
| `blocked`       | Any source's latest run failed                                                                                                                                      |
| `stale`         | A successful complete observation is older than 36 hours                                                                                                            |
| `healthy`       | Fresh automatic coverage audit matches all latest complete, non-quarantined successful runs; legacy fully reviewed sources also qualify without an automatic result |
| `demo`          | Synthetic-mode override for configured companies                                                                                                                    |

Company `lastCheckedAt` is the oldest successful complete check across its configured sources, and is null when any source lacks one. Latest failure takes precedence over stale/healthy signals. The directory communicates audit state rather than claiming all registered employers are complete.

## Implementation and limits

[Company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json), [validator](../backend/src/infrastructure/registry.ts), [coverage logic](../backend/src/application/catalog.ts), [audit CLI](../backend/src/cli/audit-source.ts).

Provider/endpoint, canonical link host and employer membership settings are validated and bound into audit evidence. [PROVIDERS](PROVIDERS.md) summarizes provider-specific invariants; [sources.json](../backend/config/sources.json) and current run/audit reports establish configured availability. Registry changes require restart. Companies without sources remain unconfigured rather than empty boards. There is no source-management UI.
