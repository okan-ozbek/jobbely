# Architecture reference index

Recorded: 30 September 2026. These references describe the current first implementation slice. Read [the root README](../README.md) for setup and hosting, and [the MVP plan](../MVP_PLAN.md) for product boundaries.

## Decisions by concern

| Reference                              | Decisions and responsibilities                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md)     | Modular monolith, separate packages/processes, dependency direction, ports and composition root     |
| [ADAPTER.md](ADAPTER.md)               | Provider adapters, canonical extraction contract, validation, pagination and provider extension     |
| [WAVE_B.md](WAVE_B.md)                 | Enterprise ATS integration, capped search traversal, employer filters and restricted-source limits  |
| [WAVE_C.md](WAVE_C.md)                 | Priority native boards, structured HTML, Amazon partitions and access gates                         |
| [WAVE_D.md](WAVE_D.md)                 | Seven deferred employers, planning membership and future onboarding boundaries                      |
| [INGESTION.md](INGESTION.md)           | Application-owned workflow, atomic publication, operator commands and PostgreSQL-backed scheduling  |
| [STORAGE.md](STORAGE.md)               | PostgreSQL/Prisma, repository and unit of work, leases, JSON evidence and version history           |
| [CLASSIFICATION.md](CLASSIFICATION.md) | Taxonomy, ordered strategies, company overrides, ambiguity and explainable decisions                |
| [LIFECYCLE.md](LIFECYCLE.md)           | Source identity, content hashing, missing observations, closure and removal quarantine              |
| [HTTP.md](HTTP.md)                     | Shared transport, allowed destinations, pacing, retries and request budgets                         |
| [SECURITY.md](SECURITY.md)             | External-content trust boundary, HTML sanitization, secrets and public read API                     |
| [API.md](API.md)                       | Fastify/TypeBox, generated OpenAPI contract, catalog queries, pagination and health routes          |
| [FRONTEND.md](FRONTEND.md)             | React/Vite, API-only dependency, URL state and cancellable request hooks                            |
| [DESIGN.md](DESIGN.md)                 | Palette, typography, minimal page layouts, responsive behavior and accessible interactions          |
| [LOGOS.md](LOGOS.md)                   | Local company assets, source records, API paths and the shared N/A fallback                         |
| [SOURCES.md](SOURCES.md)               | Company/source separation, explicit audit status, scheduling gate and coverage signals              |
| [AUDITING.md](AUDITING.md)             | Official-ID reconciliation, policy evidence, reviewed scope, activation and verified refresh guards |
| [QUALITY.md](QUALITY.md)               | Strict types, dependency checks, behavioral tests and separate integration/live-source gates        |
| [FORMATTING.md](FORMATTING.md)         | Shared Prettier style, explicit braces, editor defaults, exclusions and formatting gates            |
| [DEPLOYMENT.md](DEPLOYMENT.md)         | Static frontend, persistent Node API/worker, PostgreSQL, environment and operational recipe         |
| [SOURCE_CHECKS.md](SOURCE_CHECKS.md)   | Dated Wave A feed and official-site checks; not a permanent architecture decision                   |

## How future agents should use these references

Read the root [AGENTS.md](../AGENTS.md) first. It defines repository-wide guidance and requires a successful root lint check after the final code edit.

Before changing a concern, read its reference and follow the implementation links. Validate the current code: documentation can drift and is not executable enforcement. Preserve listed invariants unless a deliberate architecture change updates both implementation and documentation.

For a new decision, add an uppercase concern filename with a `.md` extension and record:

1. **Status/date:** implemented, proposed, or superseded; identify the replacement if superseded.
2. **Decision and rationale:** the concrete choice and requirement that motivated it.
3. **Invariants:** behavior that callers and adjacent layers rely on.
4. **Implementation and verification:** links to code, configuration and meaningful checks.
5. **Tradeoffs and extension points:** limits today and where future changes belong.

Update this index, the root README's architecture links, and related references when the design changes. Keep commands, thresholds and environment names aligned with code. Document a proposed feature as proposed until it exists and has been verified; historical source counts belong in dated evidence.

See [QUALITY.md](QUALITY.md) for verification requirements. Avoid duplicating full algorithms across documents: link to the reference that owns the policy.
