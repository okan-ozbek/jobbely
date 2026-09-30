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

## Evidence-backed official-site audits

Observed 30 September 2026, approximately 20:37 UTC. `pnpm audit:wave-a` fetched official
inventories, source feeds, robots rules and published policy/documentation references. The compact
company reports are in `backend/config/audit-evidence/`; their `artifactDirectory` fields locate
timestamped ignored raw evidence. The command correctly returned a nonzero exit code because
scope/access approval and some source comparisons remain unresolved.

| Company                | Feed vacancies | Official IDs observed | Result                                                                                                                                                                                                        |
| ---------------------- | -------------: | --------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI                 |            834 |               Unknown | Official careers page returned 403; hosted Ashby HTML did not expose a usable server-rendered inventory. Not evidence of zero vacancies.                                                                      |
| Anthropic              |            635 |                   634 | 634 exact IDs matched; one feed-only posting remains unexplained. Two prospect entries excluded from the feed.                                                                                                |
| Figma                  |            165 |                   163 | 163 exact IDs matched; two feed-only postings remain unexplained.                                                                                                                                             |
| Discord                |             58 |                    58 | All IDs matched across three boards: 48 main, 8 international, 2 EOR.                                                                                                                                         |
| Reddit                 |            145 |                   145 | Exact posting-ID set match.                                                                                                                                                                                   |
| Palantir               |            318 |                   318 | Exact posting-ID set match against its hosted Lever board.                                                                                                                                                    |
| Five Rings             |             16 |                    16 | Exact posting-ID set match against official careers links.                                                                                                                                                    |
| Radix Trading          |             15 |                    15 | Both hosted boards matched (8 university, 7 experienced); official-site robots retrieval returned HTML rather than a valid robots response, so attribution/access remain blocked.                             |
| Headlands Technologies |              8 |                     6 | Six exact IDs matched; two feed-only postings remain unexplained.                                                                                                                                             |
| Mozilla                |             81 |                    29 | All 29 official IDs matched. The other 52 postings share native Greenhouse requisition IDs with official postings and are recorded as location variants, not merged. Entity/channel scope remains unresolved. |

### Additional hiring channels and differences

Discord's official `careersNew2025.js` names `discord`, `discordinternational` and `internationaleor`
in `DISCORD_JOB_BOARDS`. The two additional boards were missing from our registry. They are now
registered as candidates, and a real PostgreSQL sync imported their ten postings. The running API
confirmed **58 Discord listings across three sources**. No existing source IDs were changed.

The unexplained feed-only postings at this observation were:

- Anthropic `5427938008`: Strategy & Operations, FDE.
- Figma `6211119004`: Account Executive, Strategic (São Paulo, Brazil).
- Figma `6112961004`: Strategic Finance, AI Innovation.
- Headlands `4336806009`: C++ Software Developer - New Grad.
- Headlands `4273272009`: Legal & Compliance Associate.

These differences may involve refresh/cache lag or deliberate official-site selection, but no cause
has been established. They were not silently excluded or treated as closed. Counts may change
between observations.

### Access-policy posture

Published employer references and ATS API documentation were captured where accessible, with
normalized-text hashes available for review. OpenAI's terms page also returned 403; Palantir's
legal page failed retrieval during this run. Discord's captured terms contain a restriction on
scraping its services without written consent: applicability to careers pages, documented ATS API
access and description display must be resolved, not assumed. Some references are policy indexes,
service terms or discovery seeds rather than established job-feed authorization.

**No company has been promoted to verified or scheduled.** Exact board matches alone do not
complete employer-scope or access/display review. The software now enforces those decisions,
reviewed policy hashes and current reconciliation rather than accepting an unsupported flag change.
See [AUDITING.md](AUDITING.md) for the review, safe activation and runtime guard procedure.
