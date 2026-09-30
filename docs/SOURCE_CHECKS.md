# Source checks

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

Live traversal success verifies the observed provider board. It does not prove that the board is the employer's only public hiring surface.

## Wave A expansion

On 30 September 2026, `pnpm sync:wave-a` successfully traversed and persisted all 11
configured boards for the 10 companies in MVP plan section 4. Every run reported
`enumerationComplete: true`; Anthropic excluded two prospect entries. The existing adapters
handled all seven additional companies without payload changes.

| Company                | Provider / board                        | Vacancies in this run | Excluded |
| ---------------------- | --------------------------------------- | --------------------: | -------: |
| OpenAI                 | Ashby / `openai`                        |                   834 |        0 |
| Anthropic              | Greenhouse / `anthropic`                |                   634 |        2 |
| Figma                  | Greenhouse / `figma`                    |                   165 |        0 |
| Discord                | Greenhouse / `discord`                  |                    48 |        0 |
| Reddit                 | Greenhouse / `reddit`                   |                   145 |        0 |
| Palantir               | Lever / `palantir`                      |                   318 |        0 |
| Five Rings             | Greenhouse / `fiveringsllc`             |                    16 |        0 |
| Radix Trading          | Greenhouse / `radixuniversity`          |                     8 |        0 |
| Radix Trading          | Greenhouse / `radixexperienced`         |                     7 |        0 |
| Headlands Technologies | Greenhouse / `headlandstechnologiesllc` |                     8 |        0 |
| Mozilla                | Greenhouse / `mozilla`                  |                    81 |        0 |

The new companies contributed **478 listings**. This refresh observed **2,264 vacancies**;
the API displayed **2,265 last-known active listings**, including one previously observed
OpenAI posting absent from the current feed. Candidate sources intentionally cannot close
missing postings, so stored active counts can exceed current feed counts.

Verification queried filtered listings and three detail endpoints per company (30 details
total), checking nonempty text/HTML descriptions and application links. The running frontend
displayed the expanded catalog and Mozilla listings. Raw response evidence for these syncs
is retained in database `Snapshot` records; the initial ignored audit files are not refreshed
by the sync command.

All sources remain `candidate`, unscheduled, and displayed as partial coverage. Complete
employer-scope reconciliation, access-policy review, and Mozilla entity/board reconciliation
remain outstanding. These counts validate the configured feeds, not worldwide employer
completeness or permission for public redisplay.
