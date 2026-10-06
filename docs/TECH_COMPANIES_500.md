# 500 technology employers: integration backlog

**Status:** Discovery and onboarding backlog; two collectors implemented and HubSpot configured with an explicit source blocker. Created and updated 6 October 2026, Europe/Amsterdam. [Atlassian](ATLASSIAN.md) is description-blocked; [Shopify](SHOPIFY.md) imported 116 jobs with independent coverage still partial; [HubSpot](HUBSPOT.md) has no usable current feed.

## Purpose and selection

Build Jobbely employer coverage one company at a time using a global shortlist of **500 distinct named employer targets**, grouped into 20 sectors of 25 entries. “Top” means prominent technology employers and relevant technology-enabled platforms: major public businesses, established software vendors, and notable private companies. This is an editorial selection for Jobbely, not a market-cap, revenue, hiring-volume, compensation or workplace-quality ranking. Equal category allocation gives the backlog breadth; it is not a statistical top-500 cutoff. Numbers are row identifiers, not integration priorities.

Some entries are separately scoped employer brands within a larger group, such as GitHub, LinkedIn and Slack. There are 500 named targets, not a claim of 500 independent parent groups. Confirm shared-board membership and avoid duplicate requisitions when onboarding related employers. Technology-enabled fintech, health, commerce and mobility businesses are intentionally included; traditional banks and quantitative trading firms remain in the existing registry but are outside this shortlist.

The companion [JSON backlog](TECH_COMPANIES_500.json) carries proposed target slugs, discovery-evidence levels, existing planning waves/provider settings, the suggested-next queue and scope-review notes. Preserve its target slugs once adopted. The app does not load this file. The runtime [company registry](../backend/config/companies.json), [source registry](../backend/config/sources.json) and their stable IDs retain their existing ownership.

## Current registry snapshot

The runtime registry now has **63 companies** and **52 source boards**. Of this shortlist:

| State             | Count | Meaning                                                                                                                        |
| ----------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------ |
| Source configured |    43 | At least one configured source; this does not establish successful imports, coverage, current availability or access approval. |
| Registered only   |     8 | Existing company slug with no configured source. Existing A–D planning assignments, including Wave D deferrals, still apply.   |
| New candidate     |   449 | Proposed target outside the runtime registry; discovery and integration remain pending.                                        |

The 12 existing finance/trading employers outside this tech shortlist are retained: Jane Street, Radix Trading, Hudson River Trading, Five Rings, Citadel, Two Sigma, Headlands Technologies, Optiver, JPMorgan Chase, Goldman Sachs, ABN AMRO, ING. This backlog does not replace the original MVP cohort or its coverage commitments. Registry counts are a 6 October snapshot; recompute them after future integrations.

## Suggested next ten

Start discovery in this order, then adjust for source access, employer scope, adapter reuse and blockers. The ordering is editorial and can change; no unsupported ATS/provider assumptions are used to claim that these are easy integrations.

| Order | Company    | Official careers page observed                       | Reason                                                                         |
| ----- | ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1     | Atlassian  | [Careers](https://www.atlassian.com/company/careers) | Broad enterprise software relevance and several technical/business functions.  |
| 2     | Shopify    | [Careers](https://www.shopify.com/careers)           | Commerce platform relevance and a distinct employer from the current registry. |
| 3     | HubSpot    | [Careers](https://www.hubspot.com/careers/jobs)      | Adds CRM/marketing technology and multiple supported job functions.            |
| 4     | ServiceNow | [Careers](https://careers.servicenow.com/)           | Adds a major enterprise workflow employer.                                     |
| 5     | Adyen      | [Careers](https://careers.adyen.com/)                | Adds a prominent payments employer with Netherlands relevance.                 |
| 6     | ASML       | [Careers](https://www.asml.com/en/careers)           | Adds a major semiconductor equipment employer with Netherlands relevance.      |
| 7     | Canva      | [Careers](https://www.lifeatcanva.com/en/)           | Adds a prominent design/productivity employer.                                 |
| 8     | Notion     | [Careers](https://www.notion.com/careers)            | Adds a prominent workplace/productivity employer.                              |
| 9     | Vercel     | [Careers](https://vercel.com/careers)                | Adds developer infrastructure with a focused employer scope.                   |
| 10    | Mistral AI | [Careers](https://mistral.ai/careers/)               | Adds a prominent European AI employer.                                         |

These ten careers pages were readable through the web research tool on 6 October 2026. Observing a careers page does not verify its full inventory, API/provider, pagination, description availability, access permission or adapter compatibility. For existing configured employers, resolving their documented blockers and auditing coverage is a separate stream of work.

Atlassian has a native Wave C candidate integration. Its feed was observed with 354 rows / 336 unique IDs, but posting 26639 has no readable description and blocks full publication. [Shopify](SHOPIFY.md) imported 116 jobs with complete public listing/detail hydration; its independent audit matched 37 visible IDs and kept coverage partial because 79 imported IDs were absent from that visible inventory. Both remain candidate and unscheduled; access/display reviews are pending. [HubSpot](HUBSPOT.md) is configured behind an explicit failure gate: its public listing and detail service returned GraphQL 404 errors, so no vacancies were imported. ServiceNow is the next discovery target. See [Atlassian's blocker](ATLASSIAN.md).

## One-company completion procedure

1. Select one target and confirm its current name, legal employer, parent/brand scope and official careers entry point. Recheck ownership and redirects; homepage seeds below are discovery aids.
2. Discover all relevant public boards, regions and hiring channels. Record evidence of official employer attribution and any access blockers.
3. Reuse an existing adapter only after verifying its payload and traversal. Add a dedicated adapter through the existing ports if needed; keep provider/network/storage details in backend infrastructure.
4. Add the stable company/source configuration for that employer. A candidate source must not become scheduled or eligible for closure merely because an import succeeded.
5. Verify complete enumeration, descriptions, original employer/application URLs, identity stability, exclusions and job-feature projection. Record dated evidence and follow the independent technical coverage, access and lifecycle gates.
6. Run behavior tests and types appropriate to the change, regenerate contracts only when the public API changes, and run final root `pnpm lint` with zero warnings. Use PostgreSQL checks for persistence/concurrency changes.
7. Update the backlog and relevant evidence documents with the actual outcome: implemented, partial, blocked or deferred. Proceed to the next employer after the current scope is reviewed; a blocker can be recorded explicitly rather than bypassed.

Follow [SOURCES](SOURCES.md), [ADAPTER](ADAPTER.md), [AUDITING](AUDITING.md), [AUTOMATIC_COVERAGE](AUTOMATIC_COVERAGE.md), [LIFECYCLE](LIFECYCLE.md) and [QUALITY](QUALITY.md). This plan does not grant access/display approvals or override existing deferrals.

## Research basis and limits

These resources informed the selection across public technology, cloud software, AI, data infrastructure, semiconductor, European scaleup and fintech ecosystems. This is a manually curated synthesis; a resource citation does not assert that every row appears in that resource or is individually verified.

- [PwC Global Top 100 companies 2026](https://www.pwc.co.uk/audit/assets/pdf/global-100/companies/global-top-100-companies-2026.pdf): Context for major public technology employers; not the ranking of this shortlist.

- [Bessemer Cloud 100 benchmarks report 2025](https://www.bvp.com/atlas/the-cloud-100-benchmarks-report): Private cloud and AI employer discovery context.

- [BVP public cloud index constituents](https://cloudindex.bvp.com/companies): Public enterprise/cloud software discovery context.

- [Y Combinator company directory](https://www.ycombinator.com/companies): Startup employer discovery context.

- [a16z Top 100 Gen AI Consumer Apps, sixth edition](https://a16z.com/100-gen-ai-apps-6/): AI product/company discovery context; products must be resolved to employers.

- [a16z Data 50](https://a16z.com/data-50/): Historical data-infrastructure discovery context; not current ownership verification.

- [SEMI member directory](https://www.semi.org/en/resources/member-directory): Semiconductor ecosystem discovery resource; membership alone is not a top-company ranking.

- [Sifted European growth-company leaderboards](https://sifted.eu/leaderboards): European scaleup discovery context.

- [CB Insights Fintech 100, 2025](https://www.cbinsights.com/research/report/top-fintech-startups-2025/): Fintech discovery context; not the ranking of this shortlist.

Current identity checks also informed consolidation:

- [Superhuman's company history](https://superhuman.com/company/about) and [the Coda-to-Superhuman Docs update](https://help.superhuman.com/hc/en-us/articles/46210093285773-What-s-changing-Coda-becomes-Superhuman-Docs) support one Superhuman target rather than separate Coda/Grammarly targets.
- [Salesloft's merger information](https://www.salesloft.com/clari-salesloft-merger) supports one Salesloft target including Clari.
- [IBM's completed Confluent acquisition](https://newsroom.ibm.com/2026-03-17-ibm-completes-acquisition-of-confluent%2C-making-real-time-data-the-engine-of-enterprise-ai-and-agents) supports reviewing that hiring scope under IBM.
- [Palo Alto Networks' CyberArk completion announcement](https://investors.paloaltonetworks.com/node/20181/pdf) supports reviewing that hiring scope under Palo Alto Networks.

Only the ten suggested-next careers pages were observed specifically for this backlog. Existing registry URLs/providers were read from repository configuration. The remaining links are **unverified homepage discovery seeds**, not validated careers pages or ATS endpoints. Current hiring, every ownership relationship, worldwide employer coverage and access/display permission remain to be checked company by company.

## Full list

Within each sector, the rows provide a discovery link and the current local registry state. **Careers observed** means one of the ten pages above; **Registry URL** means existing configuration; **Homepage seed** means unverified discovery only. Provider names in the final column describe current repository configuration, not proposed providers for new candidates.

### Global technology leaders

|   # | Company             | Discovery entry point                                                           | Registry state    | Existing slug | Configured providers |
| --: | ------------------- | ------------------------------------------------------------------------------- | ----------------- | ------------- | -------------------- |
|   1 | Microsoft           | [Registry URL](https://careers.microsoft.com/)                                  | Registered only   | `microsoft`   | —                    |
|   2 | Google              | [Registry URL](https://www.google.com/about/careers/applications/jobs/results/) | Source configured | `google`      | google               |
|   3 | Apple               | [Registry URL](https://jobs.apple.com/en-us/search)                             | Source configured | `apple`       | apple                |
|   4 | Amazon              | [Registry URL](https://www.amazon.jobs/en/search)                               | Source configured | `amazon`      | amazon               |
|   5 | Meta                | [Registry URL](https://www.metacareers.com/jobs/)                               | Source configured | `meta`        | meta                 |
|   6 | NVIDIA              | [Registry URL](https://www.nvidia.com/en-us/about-nvidia/careers/)              | Source configured | `nvidia`      | workday              |
|   7 | Samsung Electronics | [Homepage seed](https://samsung.com/)                                           | New candidate     | —             | —                    |
|   8 | Tencent             | [Homepage seed](https://tencent.com/)                                           | New candidate     | —             | —                    |
|   9 | Alibaba             | [Homepage seed](https://alibabagroup.com/)                                      | New candidate     | —             | —                    |
|  10 | Broadcom            | [Homepage seed](https://broadcom.com/)                                          | New candidate     | —             | —                    |
|  11 | Oracle              | [Registry URL](https://www.oracle.com/careers/)                                 | Registered only   | `oracle`      | —                    |
|  12 | Salesforce          | [Registry URL](https://www.salesforce.com/company/careers/)                     | Source configured | `salesforce`  | workday              |
|  13 | Adobe               | [Registry URL](https://careers.adobe.com/us/en)                                 | Source configured | `adobe`       | workday              |
|  14 | SAP                 | [Homepage seed](https://sap.com/)                                               | New candidate     | —             | —                    |
|  15 | IBM                 | [Registry URL](https://www.ibm.com/careers)                                     | Registered only   | `ibm`         | —                    |
|  16 | Cisco               | [Homepage seed](https://cisco.com/)                                             | New candidate     | —             | —                    |
|  17 | Intel               | [Registry URL](https://jobs.intel.com/)                                         | Source configured | `intel`       | workday              |
|  18 | AMD                 | [Registry URL](https://careers.amd.com/careers-home)                            | Source configured | `amd`         | icims                |
|  19 | TSMC                | [Homepage seed](https://tsmc.com/)                                              | New candidate     | —             | —                    |
|  20 | ASML                | [Careers observed](https://www.asml.com/en/careers)                             | New candidate     | —             | —                    |
|  21 | Tesla               | [Registry URL](https://www.tesla.com/careers/search/)                           | Registered only   | `tesla`       | —                    |
|  22 | OpenAI              | [Registry URL](https://openai.com/careers/search/)                              | Source configured | `openai`      | ashby                |
|  23 | Anthropic           | [Registry URL](https://www.anthropic.com/careers)                               | Source configured | `anthropic`   | greenhouse           |
|  24 | ByteDance           | [Homepage seed](https://bytedance.com/)                                         | New candidate     | —             | —                    |
|  25 | Sony                | [Homepage seed](https://sony.com/)                                              | New candidate     | —             | —                    |

### Enterprise software and business platforms

|   # | Company             | Discovery entry point                                                             | Registry state    | Existing slug | Configured providers |
| --: | ------------------- | --------------------------------------------------------------------------------- | ----------------- | ------------- | -------------------- |
|  26 | ServiceNow          | [Careers observed](https://careers.servicenow.com/)                               | New candidate     | —             | —                    |
|  27 | Workday             | [Registry URL](https://www.workday.com/en-us/company/careers/open-positions.html) | Source configured | `workday`     | workday              |
|  28 | Atlassian           | [Careers observed](https://www.atlassian.com/company/careers)                     | Source configured | C             | atlassian            |
|  29 | Intuit              | [Homepage seed](https://intuit.com/)                                              | New candidate     | —             | —                    |
|  30 | HubSpot             | [Careers observed](https://www.hubspot.com/careers/jobs)                          | Source configured | C             | hubspot              |
|  31 | Zendesk             | [Homepage seed](https://zendesk.com/)                                             | New candidate     | —             | —                    |
|  32 | Freshworks          | [Homepage seed](https://freshworks.com/)                                          | New candidate     | —             | —                    |
|  33 | Zoho                | [Homepage seed](https://zoho.com/)                                                | New candidate     | —             | —                    |
|  34 | Sage                | [Homepage seed](https://sage.com/)                                                | New candidate     | —             | —                    |
|  35 | Xero                | [Homepage seed](https://xero.com/)                                                | New candidate     | —             | —                    |
|  36 | Infor               | [Homepage seed](https://infor.com/)                                               | New candidate     | —             | —                    |
|  37 | IFS                 | [Homepage seed](https://ifs.com/)                                                 | New candidate     | —             | —                    |
|  38 | Epicor              | [Homepage seed](https://epicor.com/)                                              | New candidate     | —             | —                    |
|  39 | Acumatica           | [Homepage seed](https://acumatica.com/)                                           | New candidate     | —             | —                    |
|  40 | Odoo                | [Homepage seed](https://odoo.com/)                                                | New candidate     | —             | —                    |
|  41 | Unit4               | [Homepage seed](https://unit4.com/)                                               | New candidate     | —             | —                    |
|  42 | Anaplan             | [Homepage seed](https://anaplan.com/)                                             | New candidate     | —             | —                    |
|  43 | Coupa               | [Homepage seed](https://coupa.com/)                                               | New candidate     | —             | —                    |
|  44 | Ivalua              | [Homepage seed](https://ivalua.com/)                                              | New candidate     | —             | —                    |
|  45 | Appian              | [Homepage seed](https://appian.com/)                                              | New candidate     | —             | —                    |
|  46 | Pegasystems         | [Homepage seed](https://pega.com/)                                                | New candidate     | —             | —                    |
|  47 | UiPath              | [Homepage seed](https://uipath.com/)                                              | New candidate     | —             | —                    |
|  48 | Automation Anywhere | [Homepage seed](https://automationanywhere.com/)                                  | New candidate     | —             | —                    |
|  49 | Celonis             | [Homepage seed](https://celonis.com/)                                             | New candidate     | —             | —                    |
|  50 | Palantir            | [Registry URL](https://www.palantir.com/careers/)                                 | Source configured | `palantir`    | lever                |

### Developer tools and cloud infrastructure

|   # | Company      | Discovery entry point                                   | Registry state    | Existing slug | Configured providers |
| --: | ------------ | ------------------------------------------------------- | ----------------- | ------------- | -------------------- |
|  51 | GitHub       | [Registry URL](https://www.github.careers/careers-home) | Source configured | `github`      | icims                |
|  52 | GitLab       | [Registry URL](https://about.gitlab.com/jobs/all-jobs/) | Source configured | `gitlab`      | greenhouse           |
|  53 | Cloudflare   | [Registry URL](https://www.cloudflare.com/careers/)     | Source configured | `cloudflare`  | greenhouse           |
|  54 | DigitalOcean | [Homepage seed](https://digitalocean.com/)              | New candidate     | —             | —                    |
|  55 | Akamai       | [Homepage seed](https://akamai.com/)                    | New candidate     | —             | —                    |
|  56 | Fastly       | [Homepage seed](https://fastly.com/)                    | New candidate     | —             | —                    |
|  57 | Vercel       | [Careers observed](https://vercel.com/careers)          | New candidate     | —             | —                    |
|  58 | Netlify      | [Homepage seed](https://netlify.com/)                   | New candidate     | —             | —                    |
|  59 | Render       | [Homepage seed](https://render.com/)                    | New candidate     | —             | —                    |
|  60 | Fly.io       | [Homepage seed](https://fly.io/)                        | New candidate     | —             | —                    |
|  61 | Docker       | [Homepage seed](https://docker.com/)                    | New candidate     | —             | —                    |
|  62 | JFrog        | [Homepage seed](https://jfrog.com/)                     | New candidate     | —             | —                    |
|  63 | Sonar        | [Homepage seed](https://sonarsource.com/)               | New candidate     | —             | —                    |
|  64 | JetBrains    | [Homepage seed](https://jetbrains.com/)                 | New candidate     | —             | —                    |
|  65 | Postman      | [Homepage seed](https://postman.com/)                   | New candidate     | —             | —                    |
|  66 | Sentry       | [Homepage seed](https://sentry.io/)                     | New candidate     | —             | —                    |
|  67 | Grafana Labs | [Homepage seed](https://grafana.com/)                   | New candidate     | —             | —                    |
|  68 | CircleCI     | [Homepage seed](https://circleci.com/)                  | New candidate     | —             | —                    |
|  69 | Harness      | [Homepage seed](https://harness.io/)                    | New candidate     | —             | —                    |
|  70 | LaunchDarkly | [Homepage seed](https://launchdarkly.com/)              | New candidate     | —             | —                    |
|  71 | Temporal     | [Homepage seed](https://temporal.io/)                   | New candidate     | —             | —                    |
|  72 | Pulumi       | [Homepage seed](https://pulumi.com/)                    | New candidate     | —             | —                    |
|  73 | Supabase     | [Homepage seed](https://supabase.com/)                  | New candidate     | —             | —                    |
|  74 | Canonical    | [Homepage seed](https://canonical.com/)                 | New candidate     | —             | —                    |
|  75 | SUSE         | [Homepage seed](https://suse.com/)                      | New candidate     | —             | —                    |

### Data platforms and analytics

|   # | Company        | Discovery entry point                                                     | Registry state    | Existing slug | Configured providers |
| --: | -------------- | ------------------------------------------------------------------------- | ----------------- | ------------- | -------------------- |
|  76 | Databricks     | [Registry URL](https://www.databricks.com/company/careers/open-positions) | Source configured | `databricks`  | greenhouse           |
|  77 | Snowflake      | [Registry URL](https://careers.snowflake.com/us/en)                       | Source configured | `snowflake`   | ashby                |
|  78 | MongoDB        | [Registry URL](https://www.mongodb.com/company/careers)                   | Source configured | `mongodb`     | greenhouse           |
|  79 | Datadog        | [Registry URL](https://careers.datadoghq.com/all-jobs/)                   | Source configured | `datadog`     | greenhouse           |
|  80 | Redpanda       | [Homepage seed](https://redpanda.com/)                                    | New candidate     | —             | —                    |
|  81 | Elastic        | [Homepage seed](https://elastic.co/)                                      | New candidate     | —             | —                    |
|  82 | Redis          | [Homepage seed](https://redis.io/)                                        | New candidate     | —             | —                    |
|  83 | Cockroach Labs | [Homepage seed](https://cockroachlabs.com/)                               | New candidate     | —             | —                    |
|  84 | ClickHouse     | [Homepage seed](https://clickhouse.com/)                                  | New candidate     | —             | —                    |
|  85 | SingleStore    | [Homepage seed](https://singlestore.com/)                                 | New candidate     | —             | —                    |
|  86 | Neo4j          | [Homepage seed](https://neo4j.com/)                                       | New candidate     | —             | —                    |
|  87 | Cribl          | [Homepage seed](https://cribl.io/)                                        | New candidate     | —             | —                    |
|  88 | Couchbase      | [Homepage seed](https://couchbase.com/)                                   | New candidate     | —             | —                    |
|  89 | Cloudera       | [Homepage seed](https://cloudera.com/)                                    | New candidate     | —             | —                    |
|  90 | Fivetran       | [Homepage seed](https://fivetran.com/)                                    | New candidate     | —             | —                    |
|  91 | dbt Labs       | [Homepage seed](https://getdbt.com/)                                      | New candidate     | —             | —                    |
|  92 | Airbyte        | [Homepage seed](https://airbyte.com/)                                     | New candidate     | —             | —                    |
|  93 | Starburst      | [Homepage seed](https://starburst.io/)                                    | New candidate     | —             | —                    |
|  94 | Dremio         | [Homepage seed](https://dremio.com/)                                      | New candidate     | —             | —                    |
|  95 | ThoughtSpot    | [Homepage seed](https://thoughtspot.com/)                                 | New candidate     | —             | —                    |
|  96 | Qlik           | [Homepage seed](https://qlik.com/)                                        | New candidate     | —             | —                    |
|  97 | Alteryx        | [Homepage seed](https://alteryx.com/)                                     | New candidate     | —             | —                    |
|  98 | Amplitude      | [Homepage seed](https://amplitude.com/)                                   | New candidate     | —             | —                    |
|  99 | Mixpanel       | [Homepage seed](https://mixpanel.com/)                                    | New candidate     | —             | —                    |
| 100 | SAS            | [Homepage seed](https://sas.com/)                                         | New candidate     | —             | —                    |

### AI models and AI applications

|   # | Company            | Discovery entry point                           | Registry state | Existing slug | Configured providers |
| --: | ------------------ | ----------------------------------------------- | -------------- | ------------- | -------------------- |
| 101 | Mistral AI         | [Careers observed](https://mistral.ai/careers/) | New candidate  | —             | —                    |
| 102 | Cohere             | [Homepage seed](https://cohere.com/)            | New candidate  | —             | —                    |
| 103 | Hugging Face       | [Homepage seed](https://huggingface.co/)        | New candidate  | —             | —                    |
| 104 | Perplexity         | [Homepage seed](https://perplexity.ai/)         | New candidate  | —             | —                    |
| 105 | Anysphere (Cursor) | [Homepage seed](https://cursor.com/)            | New candidate  | —             | —                    |
| 106 | Replit             | [Homepage seed](https://replit.com/)            | New candidate  | —             | —                    |
| 107 | Lovable            | [Homepage seed](https://lovable.dev/)           | New candidate  | —             | —                    |
| 108 | ElevenLabs         | [Homepage seed](https://elevenlabs.io/)         | New candidate  | —             | —                    |
| 109 | Runway             | [Homepage seed](https://runwayml.com/)          | New candidate  | —             | —                    |
| 110 | Synthesia          | [Homepage seed](https://synthesia.io/)          | New candidate  | —             | —                    |
| 111 | HeyGen             | [Homepage seed](https://heygen.com/)            | New candidate  | —             | —                    |
| 112 | Midjourney         | [Homepage seed](https://midjourney.com/)        | New candidate  | —             | —                    |
| 113 | Stability AI       | [Homepage seed](https://stability.ai/)          | New candidate  | —             | —                    |
| 114 | Luma AI            | [Homepage seed](https://lumalabs.ai/)           | New candidate  | —             | —                    |
| 115 | Pika               | [Homepage seed](https://pika.art/)              | New candidate  | —             | —                    |
| 116 | Character.AI       | [Homepage seed](https://character.ai/)          | New candidate  | —             | —                    |
| 117 | Scale AI           | [Homepage seed](https://scale.com/)             | New candidate  | —             | —                    |
| 118 | Glean              | [Homepage seed](https://glean.com/)             | New candidate  | —             | —                    |
| 119 | Harvey             | [Homepage seed](https://harvey.ai/)             | New candidate  | —             | —                    |
| 120 | Sierra             | [Homepage seed](https://sierra.ai/)             | New candidate  | —             | —                    |
| 121 | Writer             | [Homepage seed](https://writer.com/)            | New candidate  | —             | —                    |
| 122 | Jasper             | [Homepage seed](https://jasper.ai/)             | New candidate  | —             | —                    |
| 123 | DeepL              | [Homepage seed](https://deepl.com/)             | New candidate  | —             | —                    |
| 124 | Together AI        | [Homepage seed](https://together.ai/)           | New candidate  | —             | —                    |
| 125 | Fireworks AI       | [Homepage seed](https://fireworks.ai/)          | New candidate  | —             | —                    |

### Cybersecurity and identity

|   # | Company            | Discovery entry point                                 | Registry state    | Existing slug | Configured providers |
| --: | ------------------ | ----------------------------------------------------- | ----------------- | ------------- | -------------------- |
| 126 | Palo Alto Networks | [Homepage seed](https://paloaltonetworks.com/)        | New candidate     | —             | —                    |
| 127 | CrowdStrike        | [Homepage seed](https://crowdstrike.com/)             | New candidate     | —             | —                    |
| 128 | Fortinet           | [Homepage seed](https://fortinet.com/)                | New candidate     | —             | —                    |
| 129 | Zscaler            | [Homepage seed](https://zscaler.com/)                 | New candidate     | —             | —                    |
| 130 | Check Point        | [Homepage seed](https://checkpoint.com/)              | New candidate     | —             | —                    |
| 131 | Okta               | [Registry URL](https://www.okta.com/company/careers/) | Source configured | `okta`        | greenhouse           |
| 132 | SentinelOne        | [Homepage seed](https://sentinelone.com/)             | New candidate     | —             | —                    |
| 133 | Teleport           | [Homepage seed](https://goteleport.com/)              | New candidate     | —             | —                    |
| 134 | Tenable            | [Homepage seed](https://tenable.com/)                 | New candidate     | —             | —                    |
| 135 | Rapid7             | [Homepage seed](https://rapid7.com/)                  | New candidate     | —             | —                    |
| 136 | Qualys             | [Homepage seed](https://qualys.com/)                  | New candidate     | —             | —                    |
| 137 | Rubrik             | [Homepage seed](https://rubrik.com/)                  | New candidate     | —             | —                    |
| 138 | Veeam              | [Homepage seed](https://veeam.com/)                   | New candidate     | —             | —                    |
| 139 | Cohesity           | [Homepage seed](https://cohesity.com/)                | New candidate     | —             | —                    |
| 140 | Netskope           | [Homepage seed](https://netskope.com/)                | New candidate     | —             | —                    |
| 141 | Snyk               | [Homepage seed](https://snyk.io/)                     | New candidate     | —             | —                    |
| 142 | 1Password          | [Homepage seed](https://1password.com/)               | New candidate     | —             | —                    |
| 143 | Bitwarden          | [Homepage seed](https://bitwarden.com/)               | New candidate     | —             | —                    |
| 144 | Keeper Security    | [Homepage seed](https://keepersecurity.com/)          | New candidate     | —             | —                    |
| 145 | Vanta              | [Homepage seed](https://vanta.com/)                   | New candidate     | —             | —                    |
| 146 | Drata              | [Homepage seed](https://drata.com/)                   | New candidate     | —             | —                    |
| 147 | Arctic Wolf        | [Homepage seed](https://arcticwolf.com/)              | New candidate     | —             | —                    |
| 148 | Abnormal Security  | [Homepage seed](https://abnormal.ai/)                 | New candidate     | —             | —                    |
| 149 | Darktrace          | [Homepage seed](https://darktrace.com/)               | New candidate     | —             | —                    |
| 150 | Proofpoint         | [Homepage seed](https://proofpoint.com/)              | New candidate     | —             | —                    |

### Fintech and digital banking

|   # | Company       | Discovery entry point                                      | Registry state    | Existing slug | Configured providers |
| --: | ------------- | ---------------------------------------------------------- | ----------------- | ------------- | -------------------- |
| 151 | Stripe        | [Registry URL](https://stripe.com/careers/search)          | Source configured | `stripe`      | greenhouse           |
| 152 | Adyen         | [Careers observed](https://careers.adyen.com/)             | New candidate     | —             | —                    |
| 153 | PayPal        | [Registry URL](https://careers.pypl.com/home/)             | Source configured | `paypal`      | workday              |
| 154 | Block         | [Homepage seed](https://block.xyz/)                        | New candidate     | —             | —                    |
| 155 | Coinbase      | [Registry URL](https://www.coinbase.com/careers/positions) | Source configured | `coinbase`    | greenhouse           |
| 156 | Robinhood     | [Homepage seed](https://robinhood.com/)                    | New candidate     | —             | —                    |
| 157 | Revolut       | [Homepage seed](https://revolut.com/)                      | New candidate     | —             | —                    |
| 158 | Wise          | [Homepage seed](https://wise.com/)                         | New candidate     | —             | —                    |
| 159 | Klarna        | [Homepage seed](https://klarna.com/)                       | New candidate     | —             | —                    |
| 160 | Affirm        | [Homepage seed](https://affirm.com/)                       | New candidate     | —             | —                    |
| 161 | SoFi          | [Homepage seed](https://sofi.com/)                         | New candidate     | —             | —                    |
| 162 | Chime         | [Homepage seed](https://chime.com/)                        | New candidate     | —             | —                    |
| 163 | Nubank        | [Homepage seed](https://nu.com.br/)                        | New candidate     | —             | —                    |
| 164 | N26           | [Homepage seed](https://n26.com/)                          | New candidate     | —             | —                    |
| 165 | Monzo         | [Homepage seed](https://monzo.com/)                        | New candidate     | —             | —                    |
| 166 | Starling Bank | [Homepage seed](https://starlingbank.com/)                 | New candidate     | —             | —                    |
| 167 | bunq          | [Homepage seed](https://bunq.com/)                         | New candidate     | —             | —                    |
| 168 | Plaid         | [Homepage seed](https://plaid.com/)                        | New candidate     | —             | —                    |
| 169 | Brex          | [Homepage seed](https://brex.com/)                         | New candidate     | —             | —                    |
| 170 | Ramp          | [Homepage seed](https://ramp.com/)                         | New candidate     | —             | —                    |
| 171 | Airwallex     | [Homepage seed](https://airwallex.com/)                    | New candidate     | —             | —                    |
| 172 | Mercury       | [Homepage seed](https://mercury.com/)                      | New candidate     | —             | —                    |
| 173 | Marqeta       | [Homepage seed](https://marqeta.com/)                      | New candidate     | —             | —                    |
| 174 | Checkout.com  | [Homepage seed](https://checkout.com/)                     | New candidate     | —             | —                    |
| 175 | Mollie        | [Homepage seed](https://mollie.com/)                       | New candidate     | —             | —                    |

### Payments, commerce and financial infrastructure

|   # | Company             | Discovery entry point                               | Registry state    | Existing slug | Configured providers |
| --: | ------------------- | --------------------------------------------------- | ----------------- | ------------- | -------------------- |
| 176 | Shopify             | [Careers observed](https://www.shopify.com/careers) | Source configured | C             | shopify              |
| 177 | BigCommerce         | [Homepage seed](https://bigcommerce.com/)           | New candidate     | —             | —                    |
| 178 | Wix                 | [Homepage seed](https://wix.com/)                   | New candidate     | —             | —                    |
| 179 | Squarespace         | [Homepage seed](https://squarespace.com/)           | New candidate     | —             | —                    |
| 180 | VTEX                | [Homepage seed](https://vtex.com/)                  | New candidate     | —             | —                    |
| 181 | commercetools       | [Homepage seed](https://commercetools.com/)         | New candidate     | —             | —                    |
| 182 | Commerce Layer      | [Homepage seed](https://commercelayer.io/)          | New candidate     | —             | —                    |
| 183 | Mirakl              | [Homepage seed](https://mirakl.com/)                | New candidate     | —             | —                    |
| 184 | Lightspeed Commerce | [Homepage seed](https://lightspeedhq.com/)          | New candidate     | —             | —                    |
| 185 | Toast               | [Homepage seed](https://toasttab.com/)              | New candidate     | —             | —                    |
| 186 | BILL                | [Homepage seed](https://bill.com/)                  | New candidate     | —             | —                    |
| 187 | Fiserv              | [Homepage seed](https://fiserv.com/)                | New candidate     | —             | —                    |
| 188 | FIS                 | [Homepage seed](https://fisglobal.com/)             | New candidate     | —             | —                    |
| 189 | Global Payments     | [Homepage seed](https://globalpayments.com/)        | New candidate     | —             | —                    |
| 190 | ACI Worldwide       | [Homepage seed](https://aciworldwide.com/)          | New candidate     | —             | —                    |
| 191 | Shift4              | [Homepage seed](https://shift4.com/)                | New candidate     | —             | —                    |
| 192 | Worldline           | [Homepage seed](https://worldline.com/)             | New candidate     | —             | —                    |
| 193 | Euronet Worldwide   | [Homepage seed](https://euronetworldwide.com/)      | New candidate     | —             | —                    |
| 194 | Remitly             | [Homepage seed](https://remitly.com/)               | New candidate     | —             | —                    |
| 195 | dLocal              | [Homepage seed](https://dlocal.com/)                | New candidate     | —             | —                    |
| 196 | Payoneer            | [Homepage seed](https://payoneer.com/)              | New candidate     | —             | —                    |
| 197 | Rapyd               | [Homepage seed](https://rapyd.net/)                 | New candidate     | —             | —                    |
| 198 | Razorpay            | [Homepage seed](https://razorpay.com/)              | New candidate     | —             | —                    |
| 199 | Cashfree Payments   | [Homepage seed](https://cashfree.com/)              | New candidate     | —             | —                    |
| 200 | PhonePe             | [Homepage seed](https://phonepe.com/)               | New candidate     | —             | —                    |

### Consumer platforms and marketplaces

|   # | Company       | Discovery entry point                                           | Registry state    | Existing slug | Configured providers |
| --: | ------------- | --------------------------------------------------------------- | ----------------- | ------------- | -------------------- |
| 201 | Netflix       | [Registry URL](https://explore.jobs.netflix.net/careers)        | Source configured | `netflix`     | eightfold            |
| 202 | Spotify       | [Registry URL](https://www.lifeatspotify.com/jobs)              | Source configured | `spotify`     | lever                |
| 203 | Reddit        | [Registry URL](https://redditinc.com/careers)                   | Source configured | `reddit`      | greenhouse           |
| 204 | Pinterest     | [Registry URL](https://www.pinterestcareers.com/)               | Source configured | `pinterest`   | greenhouse           |
| 205 | Snap          | [Homepage seed](https://snap.com/)                              | New candidate     | —             | —                    |
| 206 | Discord       | [Registry URL](https://discord.com/careers)                     | Source configured | `discord`     | greenhouse           |
| 207 | Dropbox       | [Registry URL](https://www.dropbox.jobs/en/jobs/)               | Source configured | `dropbox`     | greenhouse           |
| 208 | Patreon       | [Registry URL](https://www.patreon.com/careers)                 | Source configured | `patreon`     | ashby                |
| 209 | Mozilla       | [Registry URL](https://www.mozilla.org/en-US/careers/listings/) | Source configured | `mozilla`     | greenhouse           |
| 210 | LinkedIn      | [Registry URL](https://careers.linkedin.com/)                   | Source configured | `linkedin`    | linkedin             |
| 211 | X (Twitter)   | [Registry URL](https://careers.x.com/)                          | Registered only   | `x`           | —                    |
| 212 | TikTok        | [Registry URL](https://lifeattiktok.com/search)                 | Registered only   | `tiktok`      | —                    |
| 213 | eBay          | [Homepage seed](https://ebay.com/)                              | New candidate     | —             | —                    |
| 214 | Etsy          | [Homepage seed](https://etsy.com/)                              | New candidate     | —             | —                    |
| 215 | Mercado Libre | [Homepage seed](https://mercadolibre.com/)                      | New candidate     | —             | —                    |
| 216 | Coupang       | [Homepage seed](https://coupang.com/)                           | New candidate     | —             | —                    |
| 217 | Rakuten       | [Homepage seed](https://rakuten.com/)                           | New candidate     | —             | —                    |
| 218 | Sea Limited   | [Homepage seed](https://sea.com/)                               | New candidate     | —             | —                    |
| 219 | PDD Holdings  | [Homepage seed](https://pddholdings.com/)                       | New candidate     | —             | —                    |
| 220 | JD.com        | [Homepage seed](https://jd.com/)                                | New candidate     | —             | —                    |
| 221 | Zalando       | [Homepage seed](https://zalando.com/)                           | New candidate     | —             | —                    |
| 222 | Vinted        | [Homepage seed](https://vinted.com/)                            | New candidate     | —             | —                    |
| 223 | Depop         | [Homepage seed](https://depop.com/)                             | New candidate     | —             | —                    |
| 224 | Wallapop      | [Homepage seed](https://wallapop.com/)                          | New candidate     | —             | —                    |
| 225 | Carousell     | [Homepage seed](https://carousell.com/)                         | New candidate     | —             | —                    |

### Travel, mobility and logistics platforms

|   # | Company        | Discovery entry point                                        | Registry state    | Existing slug | Configured providers |
| --: | -------------- | ------------------------------------------------------------ | ----------------- | ------------- | -------------------- |
| 226 | Airbnb         | [Registry URL](https://careers.airbnb.com/positions/)        | Source configured | `airbnb`      | greenhouse           |
| 227 | Booking.com    | [Registry URL](https://careers.booking.com/)                 | Source configured | `booking`     | icims                |
| 228 | Expedia Group  | [Homepage seed](https://expediagroup.com/)                   | New candidate     | —             | —                    |
| 229 | Trip.com Group | [Homepage seed](https://trip.com/)                           | New candidate     | —             | —                    |
| 230 | Tripadvisor    | [Homepage seed](https://tripadvisor.com/)                    | New candidate     | —             | —                    |
| 231 | Hopper         | [Homepage seed](https://hopper.com/)                         | New candidate     | —             | —                    |
| 232 | TravelPerk     | [Homepage seed](https://travelperk.com/)                     | New candidate     | —             | —                    |
| 233 | Navan          | [Homepage seed](https://navan.com/)                          | New candidate     | —             | —                    |
| 234 | GetYourGuide   | [Homepage seed](https://getyourguide.com/)                   | New candidate     | —             | —                    |
| 235 | Klook          | [Homepage seed](https://klook.com/)                          | New candidate     | —             | —                    |
| 236 | Omio           | [Homepage seed](https://omio.com/)                           | New candidate     | —             | —                    |
| 237 | Trainline      | [Homepage seed](https://thetrainline.com/)                   | New candidate     | —             | —                    |
| 238 | Uber           | [Registry URL](https://www.uber.com/global/en/careers/list/) | Registered only   | `uber`        | —                    |
| 239 | Lyft           | [Homepage seed](https://lyft.com/)                           | New candidate     | —             | —                    |
| 240 | Grab           | [Homepage seed](https://grab.com/)                           | New candidate     | —             | —                    |
| 241 | GoTo           | [Homepage seed](https://gotocompany.com/)                    | New candidate     | —             | —                    |
| 242 | DoorDash       | [Homepage seed](https://doordash.com/)                       | New candidate     | —             | —                    |
| 243 | Instacart      | [Homepage seed](https://instacart.com/)                      | New candidate     | —             | —                    |
| 244 | Delivery Hero  | [Homepage seed](https://deliveryhero.com/)                   | New candidate     | —             | —                    |
| 245 | Meituan        | [Homepage seed](https://meituan.com/)                        | New candidate     | —             | —                    |
| 246 | Bolt           | [Homepage seed](https://bolt.eu/)                            | New candidate     | —             | —                    |
| 247 | BlaBlaCar      | [Homepage seed](https://blablacar.com/)                      | New candidate     | —             | —                    |
| 248 | Flexport       | [Homepage seed](https://flexport.com/)                       | New candidate     | —             | —                    |
| 249 | project44      | [Homepage seed](https://project44.com/)                      | New candidate     | —             | —                    |
| 250 | Samsara        | [Homepage seed](https://samsara.com/)                        | New candidate     | —             | —                    |

### Semiconductors and electronic design

|   # | Company                | Discovery entry point                          | Registry state | Existing slug | Configured providers |
| --: | ---------------------- | ---------------------------------------------- | -------------- | ------------- | -------------------- |
| 251 | Qualcomm               | [Homepage seed](https://qualcomm.com/)         | New candidate  | —             | —                    |
| 252 | Arm                    | [Homepage seed](https://arm.com/)              | New candidate  | —             | —                    |
| 253 | Micron Technology      | [Homepage seed](https://micron.com/)           | New candidate  | —             | —                    |
| 254 | SK hynix               | [Homepage seed](https://skhynix.com/)          | New candidate  | —             | —                    |
| 255 | Texas Instruments      | [Homepage seed](https://ti.com/)               | New candidate  | —             | —                    |
| 256 | Analog Devices         | [Homepage seed](https://analog.com/)           | New candidate  | —             | —                    |
| 257 | NXP Semiconductors     | [Homepage seed](https://nxp.com/)              | New candidate  | —             | —                    |
| 258 | Infineon Technologies  | [Homepage seed](https://infineon.com/)         | New candidate  | —             | —                    |
| 259 | STMicroelectronics     | [Homepage seed](https://st.com/)               | New candidate  | —             | —                    |
| 260 | Renesas Electronics    | [Homepage seed](https://renesas.com/)          | New candidate  | —             | —                    |
| 261 | onsemi                 | [Homepage seed](https://onsemi.com/)           | New candidate  | —             | —                    |
| 262 | Microchip Technology   | [Homepage seed](https://microchip.com/)        | New candidate  | —             | —                    |
| 263 | Marvell Technology     | [Homepage seed](https://marvell.com/)          | New candidate  | —             | —                    |
| 264 | MediaTek               | [Homepage seed](https://mediatek.com/)         | New candidate  | —             | —                    |
| 265 | GlobalFoundries        | [Homepage seed](https://gf.com/)               | New candidate  | —             | —                    |
| 266 | UMC                    | [Homepage seed](https://umc.com/)              | New candidate  | —             | —                    |
| 267 | SMIC                   | [Homepage seed](https://smics.com/)            | New candidate  | —             | —                    |
| 268 | Synopsys               | [Homepage seed](https://synopsys.com/)         | New candidate  | —             | —                    |
| 269 | Cadence Design Systems | [Homepage seed](https://cadence.com/)          | New candidate  | —             | —                    |
| 270 | Applied Materials      | [Homepage seed](https://appliedmaterials.com/) | New candidate  | —             | —                    |
| 271 | Lam Research           | [Homepage seed](https://lamresearch.com/)      | New candidate  | —             | —                    |
| 272 | KLA                    | [Homepage seed](https://kla.com/)              | New candidate  | —             | —                    |
| 273 | Tokyo Electron         | [Homepage seed](https://tel.com/)              | New candidate  | —             | —                    |
| 274 | ASM International      | [Homepage seed](https://asm.com/)              | New candidate  | —             | —                    |
| 275 | BESI                   | [Homepage seed](https://besi.com/)             | New candidate  | —             | —                    |

### Hardware, networking and industrial technology

|   # | Company                    | Discovery entry point                        | Registry state | Existing slug | Configured providers |
| --: | -------------------------- | -------------------------------------------- | -------------- | ------------- | -------------------- |
| 276 | Dell Technologies          | [Homepage seed](https://dell.com/)           | New candidate  | —             | —                    |
| 277 | HP                         | [Homepage seed](https://hp.com/)             | New candidate  | —             | —                    |
| 278 | Hewlett Packard Enterprise | [Homepage seed](https://hpe.com/)            | New candidate  | —             | —                    |
| 279 | Lenovo                     | [Homepage seed](https://lenovo.com/)         | New candidate  | —             | —                    |
| 280 | Huawei                     | [Homepage seed](https://huawei.com/)         | New candidate  | —             | —                    |
| 281 | Xiaomi                     | [Homepage seed](https://mi.com/)             | New candidate  | —             | —                    |
| 282 | ASUS                       | [Homepage seed](https://asus.com/)           | New candidate  | —             | —                    |
| 283 | Acer                       | [Homepage seed](https://acer.com/)           | New candidate  | —             | —                    |
| 284 | Logitech                   | [Homepage seed](https://logitech.com/)       | New candidate  | —             | —                    |
| 285 | Garmin                     | [Homepage seed](https://garmin.com/)         | New candidate  | —             | —                    |
| 286 | GoPro                      | [Homepage seed](https://gopro.com/)          | New candidate  | —             | —                    |
| 287 | Sonos                      | [Homepage seed](https://sonos.com/)          | New candidate  | —             | —                    |
| 288 | Arista Networks            | [Homepage seed](https://arista.com/)         | New candidate  | —             | —                    |
| 289 | Nokia                      | [Homepage seed](https://nokia.com/)          | New candidate  | —             | —                    |
| 290 | Ericsson                   | [Homepage seed](https://ericsson.com/)       | New candidate  | —             | —                    |
| 291 | ZTE                        | [Homepage seed](https://zte.com.cn/)         | New candidate  | —             | —                    |
| 292 | NetApp                     | [Homepage seed](https://netapp.com/)         | New candidate  | —             | —                    |
| 293 | Pure Storage               | [Homepage seed](https://purestorage.com/)    | New candidate  | —             | —                    |
| 294 | Western Digital            | [Homepage seed](https://westerndigital.com/) | New candidate  | —             | —                    |
| 295 | Seagate Technology         | [Homepage seed](https://seagate.com/)        | New candidate  | —             | —                    |
| 296 | Sandisk                    | [Homepage seed](https://sandisk.com/)        | New candidate  | —             | —                    |
| 297 | Ubiquiti                   | [Homepage seed](https://ui.com/)             | New candidate  | —             | —                    |
| 298 | Zebra Technologies         | [Homepage seed](https://zebra.com/)          | New candidate  | —             | —                    |
| 299 | Keysight Technologies      | [Homepage seed](https://keysight.com/)       | New candidate  | —             | —                    |
| 300 | Trimble                    | [Homepage seed](https://trimble.com/)        | New candidate  | —             | —                    |

### IT services and engineering software

|   # | Company                   | Discovery entry point                      | Registry state | Existing slug | Configured providers |
| --: | ------------------------- | ------------------------------------------ | -------------- | ------------- | -------------------- |
| 301 | Accenture                 | [Homepage seed](https://accenture.com/)    | New candidate  | —             | —                    |
| 302 | Capgemini                 | [Homepage seed](https://capgemini.com/)    | New candidate  | —             | —                    |
| 303 | Cognizant                 | [Homepage seed](https://cognizant.com/)    | New candidate  | —             | —                    |
| 304 | Tata Consultancy Services | [Homepage seed](https://tcs.com/)          | New candidate  | —             | —                    |
| 305 | Infosys                   | [Homepage seed](https://infosys.com/)      | New candidate  | —             | —                    |
| 306 | Wipro                     | [Homepage seed](https://wipro.com/)        | New candidate  | —             | —                    |
| 307 | HCLTech                   | [Homepage seed](https://hcltech.com/)      | New candidate  | —             | —                    |
| 308 | Tech Mahindra             | [Homepage seed](https://techmahindra.com/) | New candidate  | —             | —                    |
| 309 | EPAM Systems              | [Homepage seed](https://epam.com/)         | New candidate  | —             | —                    |
| 310 | Globant                   | [Homepage seed](https://globant.com/)      | New candidate  | —             | —                    |
| 311 | Thoughtworks              | [Homepage seed](https://thoughtworks.com/) | New candidate  | —             | —                    |
| 312 | Endava                    | [Homepage seed](https://endava.com/)       | New candidate  | —             | —                    |
| 313 | Sopra Steria              | [Homepage seed](https://soprasteria.com/)  | New candidate  | —             | —                    |
| 314 | Tietoevry                 | [Homepage seed](https://tietoevry.com/)    | New candidate  | —             | —                    |
| 315 | CGI                       | [Homepage seed](https://cgi.com/)          | New candidate  | —             | —                    |
| 316 | DXC Technology            | [Homepage seed](https://dxc.com/)          | New candidate  | —             | —                    |
| 317 | NTT DATA                  | [Homepage seed](https://nttdata.com/)      | New candidate  | —             | —                    |
| 318 | Fujitsu                   | [Homepage seed](https://fujitsu.com/)      | New candidate  | —             | —                    |
| 319 | NEC                       | [Homepage seed](https://nec.com/)          | New candidate  | —             | —                    |
| 320 | Autodesk                  | [Homepage seed](https://autodesk.com/)     | New candidate  | —             | —                    |
| 321 | Dassault Systemes         | [Homepage seed](https://3ds.com/)          | New candidate  | —             | —                    |
| 322 | PTC                       | [Homepage seed](https://ptc.com/)          | New candidate  | —             | —                    |
| 323 | Bentley Systems           | [Homepage seed](https://bentley.com/)      | New candidate  | —             | —                    |
| 324 | Hexagon                   | [Homepage seed](https://hexagon.com/)      | New candidate  | —             | —                    |
| 325 | AVEVA                     | [Homepage seed](https://aveva.com/)        | New candidate  | —             | —                    |

### European SaaS and digital scaleups

|   # | Company       | Discovery entry point                       | Registry state | Existing slug | Configured providers |
| --: | ------------- | ------------------------------------------- | -------------- | ------------- | -------------------- |
| 326 | Exact         | [Homepage seed](https://exact.com/)         | New candidate  | —             | —                    |
| 327 | Personio      | [Homepage seed](https://personio.com/)      | New candidate  | —             | —                    |
| 328 | Contentful    | [Homepage seed](https://contentful.com/)    | New candidate  | —             | —                    |
| 329 | Contentstack  | [Homepage seed](https://contentstack.com/)  | New candidate  | —             | —                    |
| 330 | Storyblok     | [Homepage seed](https://storyblok.com/)     | New candidate  | —             | —                    |
| 331 | Miro          | [Homepage seed](https://miro.com/)          | New candidate  | —             | —                    |
| 332 | Typeform      | [Homepage seed](https://typeform.com/)      | New candidate  | —             | —                    |
| 333 | Pleo          | [Homepage seed](https://pleo.io/)           | New candidate  | —             | —                    |
| 334 | Spendesk      | [Homepage seed](https://spendesk.com/)      | New candidate  | —             | —                    |
| 335 | Qonto         | [Homepage seed](https://qonto.com/)         | New candidate  | —             | —                    |
| 336 | Pennylane     | [Homepage seed](https://pennylane.com/)     | New candidate  | —             | —                    |
| 337 | Alan          | [Homepage seed](https://alan.com/)          | New candidate  | —             | —                    |
| 338 | Doctolib      | [Homepage seed](https://doctolib.com/)      | New candidate  | —             | —                    |
| 339 | Back Market   | [Homepage seed](https://backmarket.com/)    | New candidate  | —             | —                    |
| 340 | Contentsquare | [Homepage seed](https://contentsquare.com/) | New candidate  | —             | —                    |
| 341 | Dataiku       | [Homepage seed](https://dataiku.com/)       | New candidate  | —             | —                    |
| 342 | Collibra      | [Homepage seed](https://collibra.com/)      | New candidate  | —             | —                    |
| 343 | Showpad       | [Homepage seed](https://showpad.com/)       | New candidate  | —             | —                    |
| 344 | AFAS Software | [Homepage seed](https://afas.nl/)           | New candidate  | —             | —                    |
| 345 | TeamViewer    | [Homepage seed](https://teamviewer.com/)    | New candidate  | —             | —                    |
| 346 | Nemetschek    | [Homepage seed](https://nemetschek.com/)    | New candidate  | —             | —                    |
| 347 | TeamSystem    | [Homepage seed](https://teamsystem.com/)    | New candidate  | —             | —                    |
| 348 | Visma         | [Homepage seed](https://visma.com/)         | New candidate  | —             | —                    |
| 349 | Fortnox       | [Homepage seed](https://fortnox.se/)        | New candidate  | —             | —                    |
| 350 | Kaseya        | [Homepage seed](https://kaseya.com/)        | New candidate  | —             | —                    |

### Asia-Pacific internet and software

|   # | Company            | Discovery entry point                               | Registry state | Existing slug | Configured providers |
| --: | ------------------ | --------------------------------------------------- | -------------- | ------------- | -------------------- |
| 351 | Baidu              | [Homepage seed](https://baidu.com/)                 | New candidate  | —             | —                    |
| 352 | NetEase            | [Homepage seed](https://netease.com/)               | New candidate  | —             | —                    |
| 353 | Kuaishou           | [Homepage seed](https://kuaishou.com/)              | New candidate  | —             | —                    |
| 354 | Bilibili           | [Homepage seed](https://bilibili.com/)              | New candidate  | —             | —                    |
| 355 | Weibo              | [Homepage seed](https://weibo.com/)                 | New candidate  | —             | —                    |
| 356 | Naver              | [Homepage seed](https://navercorp.com/)             | New candidate  | —             | —                    |
| 357 | Kakao              | [Homepage seed](https://kakaocorp.com/)             | New candidate  | —             | —                    |
| 358 | LY Corporation     | [Homepage seed](https://lycorp.co.jp/)              | New candidate  | —             | —                    |
| 359 | CyberAgent         | [Homepage seed](https://cyberagent.co.jp/)          | New candidate  | —             | —                    |
| 360 | GMO Internet Group | [Homepage seed](https://gmo.jp/)                    | New candidate  | —             | —                    |
| 361 | Rakus              | [Homepage seed](https://rakus.co.jp/)               | New candidate  | —             | —                    |
| 362 | Mercari            | [Homepage seed](https://mercari.com/)               | New candidate  | —             | —                    |
| 363 | SmartNews          | [Homepage seed](https://smartnews.com/)             | New candidate  | —             | —                    |
| 364 | freee              | [Homepage seed](https://freee.co.jp/)               | New candidate  | —             | —                    |
| 365 | Money Forward      | [Homepage seed](https://moneyforward.com/)          | New candidate  | —             | —                    |
| 366 | Sansan             | [Homepage seed](https://sansan.com/)                | New candidate  | —             | —                    |
| 367 | Appier             | [Homepage seed](https://appier.com/)                | New candidate  | —             | —                    |
| 368 | Preferred Networks | [Homepage seed](https://preferred.jp/)              | New candidate  | —             | —                    |
| 369 | Canva              | [Careers observed](https://www.lifeatcanva.com/en/) | New candidate  | —             | —                    |
| 370 | Xendit             | [Homepage seed](https://xendit.co/)                 | New candidate  | —             | —                    |
| 371 | BrowserStack       | [Homepage seed](https://browserstack.com/)          | New candidate  | —             | —                    |
| 372 | Traveloka          | [Homepage seed](https://traveloka.com/)             | New candidate  | —             | —                    |
| 373 | Carsome            | [Homepage seed](https://carsome.my/)                | New candidate  | —             | —                    |
| 374 | Lazada             | [Homepage seed](https://lazada.com/)                | New candidate  | —             | —                    |
| 375 | Bukalapak          | [Homepage seed](https://bukalapak.com/)             | New candidate  | —             | —                    |

### Gaming and interactive entertainment

|   # | Company                | Discovery entry point                                          | Registry state    | Existing slug | Configured providers |
| --: | ---------------------- | -------------------------------------------------------------- | ----------------- | ------------- | -------------------- |
| 376 | Nintendo               | [Homepage seed](https://nintendo.com/)                         | New candidate     | —             | —                    |
| 377 | Electronic Arts        | [Homepage seed](https://ea.com/)                               | New candidate     | —             | —                    |
| 378 | Take-Two Interactive   | [Homepage seed](https://take2games.com/)                       | New candidate     | —             | —                    |
| 379 | Ubisoft                | [Homepage seed](https://ubisoft.com/)                          | New candidate     | —             | —                    |
| 380 | Epic Games             | [Homepage seed](https://epicgames.com/)                        | New candidate     | —             | —                    |
| 381 | Valve                  | [Homepage seed](https://valvesoftware.com/)                    | New candidate     | —             | —                    |
| 382 | Roblox                 | [Homepage seed](https://roblox.com/)                           | New candidate     | —             | —                    |
| 383 | Unity                  | [Homepage seed](https://unity.com/)                            | New candidate     | —             | —                    |
| 384 | Riot Games             | [Registry URL](https://www.riotgames.com/en/work-with-us/jobs) | Source configured | `riot-games`  | greenhouse           |
| 385 | Blizzard Entertainment | [Registry URL](https://careers.blizzard.com/global/en)         | Source configured | `blizzard`    | workday              |
| 386 | Bungie                 | [Homepage seed](https://bungie.net/)                           | New candidate     | —             | —                    |
| 387 | CD Projekt             | [Homepage seed](https://cdprojekt.com/)                        | New candidate     | —             | —                    |
| 388 | Square Enix            | [Homepage seed](https://square-enix.com/)                      | New candidate     | —             | —                    |
| 389 | Capcom                 | [Homepage seed](https://capcom.com/)                           | New candidate     | —             | —                    |
| 390 | Konami                 | [Homepage seed](https://konami.com/)                           | New candidate     | —             | —                    |
| 391 | Bandai Namco           | [Homepage seed](https://bandainamco.co.jp/)                    | New candidate     | —             | —                    |
| 392 | Sega                   | [Homepage seed](https://sega.com/)                             | New candidate     | —             | —                    |
| 393 | Krafton                | [Homepage seed](https://krafton.com/)                          | New candidate     | —             | —                    |
| 394 | Nexon                  | [Homepage seed](https://nexon.com/)                            | New candidate     | —             | —                    |
| 395 | NCSoft                 | [Homepage seed](https://ncsoft.com/)                           | New candidate     | —             | —                    |
| 396 | Netmarble              | [Homepage seed](https://netmarble.com/)                        | New candidate     | —             | —                    |
| 397 | Supercell              | [Homepage seed](https://supercell.com/)                        | New candidate     | —             | —                    |
| 398 | King                   | [Homepage seed](https://king.com/)                             | New candidate     | —             | —                    |
| 399 | Scopely                | [Homepage seed](https://scopely.com/)                          | New candidate     | —             | —                    |
| 400 | Niantic Spatial        | [Homepage seed](https://nianticspatial.com/)                   | New candidate     | —             | —                    |

### Health technology and life-sciences software

|   # | Company           | Discovery entry point                        | Registry state | Existing slug | Configured providers |
| --: | ----------------- | -------------------------------------------- | -------------- | ------------- | -------------------- |
| 401 | Veeva Systems     | [Homepage seed](https://veeva.com/)          | New candidate  | —             | —                    |
| 402 | Doximity          | [Homepage seed](https://doximity.com/)       | New candidate  | —             | —                    |
| 403 | Teladoc Health    | [Homepage seed](https://teladochealth.com/)  | New candidate  | —             | —                    |
| 404 | Hims & Hers       | [Homepage seed](https://hims.com/)           | New candidate  | —             | —                    |
| 405 | GoodRx            | [Homepage seed](https://goodrx.com/)         | New candidate  | —             | —                    |
| 406 | Zocdoc            | [Homepage seed](https://zocdoc.com/)         | New candidate  | —             | —                    |
| 407 | Oscar Health      | [Homepage seed](https://hioscar.com/)        | New candidate  | —             | —                    |
| 408 | Omada Health      | [Homepage seed](https://omadahealth.com/)    | New candidate  | —             | —                    |
| 409 | Hinge Health      | [Homepage seed](https://hingehealth.com/)    | New candidate  | —             | —                    |
| 410 | Headspace         | [Homepage seed](https://headspace.com/)      | New candidate  | —             | —                    |
| 411 | Spring Health     | [Homepage seed](https://springhealth.com/)   | New candidate  | —             | —                    |
| 412 | Lyra Health       | [Homepage seed](https://lyrahealth.com/)     | New candidate  | —             | —                    |
| 413 | Modern Health     | [Homepage seed](https://modernhealth.com/)   | New candidate  | —             | —                    |
| 414 | Maven Clinic      | [Homepage seed](https://mavenclinic.com/)    | New candidate  | —             | —                    |
| 415 | Ro                | [Homepage seed](https://ro.co/)              | New candidate  | —             | —                    |
| 416 | Tempus AI         | [Homepage seed](https://tempus.com/)         | New candidate  | —             | —                    |
| 417 | Flatiron Health   | [Homepage seed](https://flatiron.com/)       | New candidate  | —             | —                    |
| 418 | Benchling         | [Homepage seed](https://benchling.com/)      | New candidate  | —             | —                    |
| 419 | Recursion         | [Homepage seed](https://recursion.com/)      | New candidate  | —             | —                    |
| 420 | Schrodinger       | [Homepage seed](https://schrodinger.com/)    | New candidate  | —             | —                    |
| 421 | Insilico Medicine | [Homepage seed](https://insilico.com/)       | New candidate  | —             | —                    |
| 422 | SOPHiA GENETICS   | [Homepage seed](https://sophiagenetics.com/) | New candidate  | —             | —                    |
| 423 | PathAI            | [Homepage seed](https://pathai.com/)         | New candidate  | —             | —                    |
| 424 | Aidoc             | [Homepage seed](https://aidoc.com/)          | New candidate  | —             | —                    |
| 425 | Viz.ai            | [Homepage seed](https://viz.ai/)             | New candidate  | —             | —                    |

### Robotics, autonomy, space and advanced computing

|   # | Company           | Discovery entry point                          | Registry state | Existing slug | Configured providers |
| --: | ----------------- | ---------------------------------------------- | -------------- | ------------- | -------------------- |
| 426 | SpaceX            | [Homepage seed](https://spacex.com/)           | New candidate  | —             | —                    |
| 427 | Rocket Lab        | [Homepage seed](https://rocketlabusa.com/)     | New candidate  | —             | —                    |
| 428 | Blue Origin       | [Homepage seed](https://blueorigin.com/)       | New candidate  | —             | —                    |
| 429 | Anduril           | [Homepage seed](https://anduril.com/)          | New candidate  | —             | —                    |
| 430 | Shield AI         | [Homepage seed](https://shield.ai/)            | New candidate  | —             | —                    |
| 431 | Skydio            | [Homepage seed](https://skydio.com/)           | New candidate  | —             | —                    |
| 432 | Zipline           | [Homepage seed](https://flyzipline.com/)       | New candidate  | —             | —                    |
| 433 | Waymo             | [Homepage seed](https://waymo.com/)            | New candidate  | —             | —                    |
| 434 | Zoox              | [Homepage seed](https://zoox.com/)             | New candidate  | —             | —                    |
| 435 | Aurora            | [Homepage seed](https://aurora.tech/)          | New candidate  | —             | —                    |
| 436 | Nuro              | [Homepage seed](https://nuro.ai/)              | New candidate  | —             | —                    |
| 437 | Applied Intuition | [Homepage seed](https://appliedintuition.com/) | New candidate  | —             | —                    |
| 438 | Mobileye          | [Homepage seed](https://mobileye.com/)         | New candidate  | —             | —                    |
| 439 | Boston Dynamics   | [Homepage seed](https://bostondynamics.com/)   | New candidate  | —             | —                    |
| 440 | Figure AI         | [Homepage seed](https://figure.ai/)            | New candidate  | —             | —                    |
| 441 | Agility Robotics  | [Homepage seed](https://agilityrobotics.com/)  | New candidate  | —             | —                    |
| 442 | Covariant         | [Homepage seed](https://covariant.ai/)         | New candidate  | —             | —                    |
| 443 | Skild AI          | [Homepage seed](https://skild.ai/)             | New candidate  | —             | —                    |
| 444 | Apptronik         | [Homepage seed](https://apptronik.com/)        | New candidate  | —             | —                    |
| 445 | Sanctuary AI      | [Homepage seed](https://sanctuary.ai/)         | New candidate  | —             | —                    |
| 446 | Cerebras Systems  | [Homepage seed](https://cerebras.ai/)          | New candidate  | —             | —                    |
| 447 | Groq              | [Homepage seed](https://groq.com/)             | New candidate  | —             | —                    |
| 448 | Tenstorrent       | [Homepage seed](https://tenstorrent.com/)      | New candidate  | —             | —                    |
| 449 | IonQ              | [Homepage seed](https://ionq.com/)             | New candidate  | —             | —                    |
| 450 | Quantinuum        | [Homepage seed](https://quantinuum.com/)       | New candidate  | —             | —                    |

### Workplace, productivity and HR technology

|   # | Company        | Discovery entry point                               | Registry state    | Existing slug | Configured providers |
| --: | -------------- | --------------------------------------------------- | ----------------- | ------------- | -------------------- |
| 451 | Figma          | [Registry URL](https://www.figma.com/careers/)      | Source configured | `figma`       | greenhouse           |
| 452 | Notion         | [Careers observed](https://www.notion.com/careers)  | New candidate     | —             | —                    |
| 453 | Slack          | [Registry URL](https://slack.com/careers)           | Source configured | `slack`       | workday              |
| 454 | Zoom           | [Registry URL](https://careers.zoom.us/jobs/search) | Source configured | `zoom`        | workday              |
| 455 | Asana          | [Homepage seed](https://asana.com/)                 | New candidate     | —             | —                    |
| 456 | monday.com     | [Homepage seed](https://monday.com/)                | New candidate     | —             | —                    |
| 457 | Smartsheet     | [Homepage seed](https://smartsheet.com/)            | New candidate     | —             | —                    |
| 458 | Airtable       | [Homepage seed](https://airtable.com/)              | New candidate     | —             | —                    |
| 459 | ClickUp        | [Homepage seed](https://clickup.com/)               | New candidate     | —             | —                    |
| 460 | Linear         | [Homepage seed](https://linear.app/)                | New candidate     | —             | —                    |
| 461 | Superhuman     | [Homepage seed](https://superhuman.com/)            | New candidate     | —             | —                    |
| 462 | Lucid Software | [Homepage seed](https://lucid.co/)                  | New candidate     | —             | —                    |
| 463 | DocuSign       | [Homepage seed](https://docusign.com/)              | New candidate     | —             | —                    |
| 464 | Mural          | [Homepage seed](https://mural.co/)                  | New candidate     | —             | —                    |
| 465 | Calendly       | [Homepage seed](https://calendly.com/)              | New candidate     | —             | —                    |
| 466 | Gusto          | [Homepage seed](https://gusto.com/)                 | New candidate     | —             | —                    |
| 467 | Rippling       | [Homepage seed](https://rippling.com/)              | New candidate     | —             | —                    |
| 468 | Deel           | [Homepage seed](https://deel.com/)                  | New candidate     | —             | —                    |
| 469 | Remote         | [Homepage seed](https://remote.com/)                | New candidate     | —             | —                    |
| 470 | Oyster         | [Homepage seed](https://oysterhr.com/)              | New candidate     | —             | —                    |
| 471 | BambooHR       | [Homepage seed](https://bamboohr.com/)              | New candidate     | —             | —                    |
| 472 | HiBob          | [Homepage seed](https://hibob.com/)                 | New candidate     | —             | —                    |
| 473 | ADP            | [Homepage seed](https://adp.com/)                   | New candidate     | —             | —                    |
| 474 | Paycom         | [Homepage seed](https://paycom.com/)                | New candidate     | —             | —                    |
| 475 | Paylocity      | [Homepage seed](https://paylocity.com/)             | New candidate     | —             | —                    |

### Marketing, media, education and vertical software

|   # | Company                     | Discovery entry point                          | Registry state  | Existing slug | Configured providers |
| --: | --------------------------- | ---------------------------------------------- | --------------- | ------------- | -------------------- |
| 476 | The Trade Desk              | [Homepage seed](https://thetradedesk.com/)     | New candidate   | —             | —                    |
| 477 | AppLovin                    | [Homepage seed](https://applovin.com/)         | New candidate   | —             | —                    |
| 478 | Braze                       | [Homepage seed](https://braze.com/)            | New candidate   | —             | —                    |
| 479 | Klaviyo                     | [Homepage seed](https://klaviyo.com/)          | New candidate   | —             | —                    |
| 480 | Attentive                   | [Homepage seed](https://attentive.com/)        | New candidate   | —             | —                    |
| 481 | Iterable                    | [Homepage seed](https://iterable.com/)         | New candidate   | —             | —                    |
| 482 | Intercom                    | [Homepage seed](https://intercom.com/)         | New candidate   | —             | —                    |
| 483 | Gong                        | [Homepage seed](https://gong.io/)              | New candidate   | —             | —                    |
| 484 | Salesloft (including Clari) | [Homepage seed](https://salesloft.com/)        | New candidate   | —             | —                    |
| 485 | Seismic                     | [Homepage seed](https://seismic.com/)          | New candidate   | —             | —                    |
| 486 | Outreach                    | [Homepage seed](https://outreach.io/)          | New candidate   | —             | —                    |
| 487 | 6sense                      | [Homepage seed](https://6sense.com/)           | New candidate   | —             | —                    |
| 488 | Demandbase                  | [Homepage seed](https://demandbase.com/)       | New candidate   | —             | —                    |
| 489 | Bloomberg                   | [Registry URL](https://careers.bloomberg.com/) | Registered only | `bloomberg`   | —                    |
| 490 | Duolingo                    | [Homepage seed](https://duolingo.com/)         | New candidate   | —             | —                    |
| 491 | Coursera                    | [Homepage seed](https://coursera.org/)         | New candidate   | —             | —                    |
| 492 | Udemy                       | [Homepage seed](https://udemy.com/)            | New candidate   | —             | —                    |
| 493 | Quizlet                     | [Homepage seed](https://quizlet.com/)          | New candidate   | —             | —                    |
| 494 | Kahoot!                     | [Homepage seed](https://kahoot.com/)           | New candidate   | —             | —                    |
| 495 | Instructure                 | [Homepage seed](https://instructure.com/)      | New candidate   | —             | —                    |
| 496 | Procore                     | [Homepage seed](https://procore.com/)          | New candidate   | —             | —                    |
| 497 | ServiceTitan                | [Homepage seed](https://servicetitan.com/)     | New candidate   | —             | —                    |
| 498 | AppFolio                    | [Homepage seed](https://appfolio.com/)         | New candidate   | —             | —                    |
| 499 | CCC Intelligent Solutions   | [Homepage seed](https://cccis.com/)            | New candidate   | —             | —                    |
| 500 | Guidewire                   | [Homepage seed](https://guidewire.com/)        | New candidate   | —             | —                    |

## Verification for this artifact

Check that the JSON contains exactly 500 unique names, target slugs and discovery URLs; numbers must be contiguous from 1 to 500 and every sector must have 25 targets. Validate all existing-company matches against the current registry, all suggested-next references against the shortlist, HTTPS URL syntax, local documentation links and Markdown/JSON formatting. Those checks establish artifact consistency, not live integration correctness. Each implemented integration records its behavior checks and live limits separately; see [Atlassian](ATLASSIAN.md).
