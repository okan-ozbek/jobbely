# Initial source checks

Observed on 30 September 2026. Counts are observations of public feeds at that time, not promises about future vacancy counts or a claim of complete employer coverage.

| Company   | Provider and public feed                                                                        | Advertised postings | Excluded | Result                                                    |
| --------- | ----------------------------------------------------------------------------------------------- | ------------------: | -------: | --------------------------------------------------------- |
| OpenAI    | [Ashby: openai](https://api.ashbyhq.com/posting-api/job-board/openai)                           |                 832 |        0 | Entire feed decoded and persisted                         |
| Anthropic | [Greenhouse: anthropic](https://boards-api.greenhouse.io/v1/boards/anthropic/jobs?content=true) |                 634 |        2 | Entire feed decoded; prospect entries excluded; persisted |
| Palantir  | [Lever: palantir](https://api.lever.co/v0/postings/palantir?mode=json)                          |                 318 |        0 | Paginated feed traversed, decoded and persisted           |

Raw payload/traversal evidence lives under ignored `backend/data/audits/`, and ingestion evidence is retained in the database's `Snapshot` records. Sources remain `candidate` with scheduling disabled. The application reports coverage as partial and does not use their absences to close jobs.

Live checks exposed nullable Ashby workplace/remote fields and nullable Greenhouse office locations beyond the initial fixture assumptions. The adapters now preserve these as unknown or omit unavailable location text, with regression coverage. This avoids inferring on-site work from a missing remote flag.

## Verified behavior

- Public transport fetched JSON without credentials or AI.
- The adapters validated every traversed item and produced stable source identities and full descriptions.
- The use case sanitized HTML, retained original department labels and classified functions using explicit mapping/title rules.
- Persistent publication wrote 1,784 postings across the three sources.
- Four real PostgreSQL tests passed: independent-client lease exclusion, duplicate rejection, missing/reappearing identity preservation, and transaction rollback when evidence persistence fails after posting writes.

## Still required for source onboarding

Compare each feed with the official company careers site, including regional partitions, related entities, multiple brands and independent requisitions. Verify representative source IDs and details, capture count comparisons, document exclusions, and review the policy for permitted public access. Only then change `auditStatus` to `verified`; enable scheduling separately.

Live traversal success verifies the observed provider board. It does not prove that the board is the employer's only public hiring surface. The other eight candidate boards in the initial cohort remain unaudited.
