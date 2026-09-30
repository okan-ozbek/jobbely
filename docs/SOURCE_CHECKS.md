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

## Wave B full imports

Observed 30 September 2026 (UTC), with the final Salesforce run completing at 22:14 UTC.
All 31 Wave B companies now have source configuration and pending audit plans. Full
extraction and atomic PostgreSQL publication succeeded for **29 companies**, storing
**10,427 active postings**. The following counts describe configured feeds at this observation.

| Company     | Provider    | Imported postings | Excluded entries |
| ----------- | ----------- | ----------------: | ---------------: |
| AMD         | iCIMS       |             1,244 |                0 |
| Databricks  | Greenhouse  |               882 |                0 |
| Booking.com | iCIMS       |                99 |               43 |
| Snowflake   | Ashby       |               345 |                0 |
| Airbnb      | Greenhouse  |               157 |                0 |
| HRT         | Greenhouse  |                89 |                0 |
| Optiver     | Greenhouse  |               169 |                0 |
| Pinterest   | Greenhouse  |               151 |                0 |
| Datadog     | Greenhouse  |               433 |                0 |
| Dropbox     | Greenhouse  |                37 |                0 |
| Coinbase    | Greenhouse  |               216 |                0 |
| Slack       | Workday     |                16 |                0 |
| Stripe      | Greenhouse  |               714 |                0 |
| Spotify     | Lever       |                80 |                0 |
| MongoDB     | Greenhouse  |               396 |                0 |
| Okta        | Greenhouse  |               363 |                0 |
| Salesforce  | Workday     |             1,515 |                0 |
| Adobe       | Workday     |               541 |                0 |
| Patreon     | Ashby       |                15 |                0 |
| Cloudflare  | Greenhouse  |               395 |                0 |
| Zoom        | Workday     |                91 |                0 |
| Workday     | Workday     |               370 |                3 |
| GitHub      | iCIMS       |                73 |                0 |
| GitLab      | Greenhouse  |               203 |                0 |
| PayPal      | Workday     |               285 |                0 |
| Intel       | Workday     |               606 |                0 |
| ING         | Workday     |               737 |                2 |
| Riot Games  | Greenhouse  |               167 |                0 |
| Blizzard    | Workday     |                38 |                0 |
| NVIDIA      | Workday     |           Blocked |          Unknown |
| LinkedIn    | Access gate |           Blocked |          Unknown |

Booking.com's 43 exclusions are other brands in the native Booking Holdings feed.
Workday and ING exclusions follow the existing non-vacancy title policy. Salesforce
and Slack use separate native sites and may overlap; these are per-source counts, not
a count of globally unique employer vacancies.

NVIDIA repeatedly returned a listing with only `bulletFields: ["JR2018974"]`, omitting
the required title and detail path. Complete extraction fails instead of dropping that
entry or publishing a partial board. LinkedIn's employer search lacks an authorized
feed; the implementation reports an access blocker rather than scraping the restricted
guest search or treating an empty historical ATS board as current coverage. Neither
blocked result establishes zero vacancies. See [WAVE_B.md](WAVE_B.md).

All successful feeds supplied full descriptions. Workday hydrated every enumerated
posting before publication, including the capped/partitioned Adobe inventory. Salesforce
took approximately 27 minutes at the configured host pacing; its lease was renewed
throughout. Drift detected during earlier traversal attempts caused those runs to fail;
successful retries supplied the counts above. No failed run published partial data.

The running API returned filtered listings for all 29 imported companies. Three detail
requests per company (**87 details**) verified company attribution, nonempty text/HTML
descriptions and HTTPS application links. Both blocked companies returned the explicit
blocked coverage state with no stored listings.

The [durable report](../backend/config/integration-evidence/wave-b.json) records configuration
hashes, exact publication run IDs and representative posting links. Diagnostic artifact
hashes refer to earlier ignored observations and can differ from later published counts.
Exact successful-run response bodies are retained in database `Snapshot` records. Early
captures predate the versioned POST request envelope; new captures also retain offsets
and facet filters. Request metadata was not retroactively invented for older captures.

The root `pnpm check` passed formatting, boundaries, logo checks, lint, strict types,
78 non-database tests, contract generation and both builds. A separate run against
`jobbely_test_wave_b` passed all **84 tests**, including six PostgreSQL tests for atomic
publication, lease ownership/expiry and POST evidence storage.

All new sources remain candidate and unscheduled. Company-scope reconciliation and
access/display review remain pending; full feed imports alone do not approve automatic
scheduling, posting closure or a worldwide completeness claim.

## Wave C priority sources

Observed 1 October 2026, approximately 00:20–01:10 Europe/Amsterdam (30 September, 22:20–23:10 UTC).
The first Wave C batch configures Meta, Apple, Netflix, Google and Amazon. At this observation,
fourteen other Wave C employers were unconfigured. Later on 1 October 2026, seven of those
employers were deferred to [Wave D](WAVE_D.md), without adding integrations or changing these
live results. See [WAVE_C.md](WAVE_C.md) for implementation decisions.

| Company | Live result                                                                                                                                               | Published postings |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -----------------: |
| Meta    | Explicit access gate: published policy requires express written permission                                                                                |               None |
| Apple   | Full details validated for four representative retail/corporate/location postings; complete search traversal rejected inconsistent totals or repeated IDs |               None |
| Netflix | All 469 advertised positions hydrated; nine explicit non-vacancy exclusions; successful PostgreSQL publication                                            |                460 |
| Google  | First career page accessible; paginated searches disallowed and no exhaustive authorized feed established                                                 |               None |
| Amazon  | Native category traversal and description payloads observed; complete import rejected inconsistent totals/early pagination termination                    |               None |

“None” means no stored Wave C postings for that source, not zero employer vacancies.
Apple initially advertised 6,144 search results. Amazon initially reported a capped
10,000 hits while its 37 native category facets summed to 22,554. These observations
are diagnostic inventory evidence, not complete import counts.

Apple's default search redirected to a USA filter. The adapter instead requested an
explicitly empty location filter and validated native page/filter/sort echoes. Live checks
also identified international title slugs, native location suffixes, managed retail `PIPE-`
IDs, and internal requisition IDs that differ from public posting numbers. Four complete
details validated after mapping those fields, including two native location postings for
the same requisition. Their descriptions remain distinct stored identities in the adapter;
no sampled subset was published. Both newest and documented location ordering encountered
inventory changes during traversal. The full initial detail import remains unvalidated.

Amazon's feed exposed full descriptions plus basic/preferred qualifications. Native URL
variants include absent title slugs, account.amazon.com links and `SF` hiring records using
the exact native Salesforce requisition in their application URL. Fixtures and live payload
inspection established these mappings. Subsequent full traversals still failed inventory
consistency checks, including the real `SyncSource` run. No first-10,000 subset or failed
partition snapshot was published. The latest source error is recorded in PostgreSQL.

Netflix's publication used the captured full extraction through the normal ingestion
pipeline. The running API returned 460 listings and three tested detail endpoints with
nonempty sanitized text/HTML and native application entry points. Meta, Google and Apple
coverage endpoints displayed blocked state with zero stored postings. The
[durable report](../backend/config/integration-evidence/wave-c.json) records per-source run
IDs, configuration bindings, validated links and ignored diagnostic hashes. Successful
Netflix response evidence is retained in database snapshots; failed sources retain error
summaries and separate local diagnostic artifacts.

`pnpm check` passed formatting, boundaries, all 60 logo paths, zero-warning lint, strict
types, 105 non-database tests, contract generation and both builds. A separate dedicated
PostgreSQL run passed all 112 tests, including seven transaction tests. Cross-batch tests
verified stable identities/version updates and complete rollback after evidence failure.

All five sources remain candidate and unscheduled. Employer-wide scope, additional native
hiring channels and access/display approval remain pending. Apple/Amazon require a passing
complete import before their adapters can be described as fully validated live integrations.
