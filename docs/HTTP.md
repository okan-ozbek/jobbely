# Decision: shared bounded public transport

**Status:** Implemented for public ATS feeds including Workday/iCIMS, 30 September 2026.

## Decision and rationale

Provider adapters use the `JsonTransport` port. `PublicJsonTransport` owns request policy so pacing, retry and destination rules do not diverge between adapters. Fake transports make provider tests deterministic.

## Implemented policy

| Concern            | Behavior                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Destinations       | HTTPS only; exact allowlist of Greenhouse, Ashby, Lever, configured Workday tenants and AMD/Booking.com/GitHub public iCIMS feed hosts |
| URL constraints    | No credentials or explicit port; redirects fail rather than being followed                                                             |
| Concurrency/pacing | One in-flight request per host per transport instance; starts at least one second apart                                                |
| Timeout            | 30 seconds per attempt                                                                                                                 |
| Retries            | At most four attempts for transient network/type/timeout errors and HTTP 429/5xx                                                       |
| Backoff            | Exponential delay; rate-limit/server retries add small jitter                                                                          |
| Retry-After        | Seconds or HTTP date honored; delays over 30 seconds fail this run for later retry                                                     |
| Body               | JSON content type required; streamed size bounded to 32 MiB                                                                            |
| Evidence           | Requested URL, fetch timestamp and parsed JSON returned together                                                                       |

`JsonSearchTransport` extends the JSON port with POST for Workday's read-only CXS jobs search. POST requires an explicitly allowlisted Workday host and `/wday/cxs/<tenant>/<site>/jobs` path; applications and arbitrary destinations are rejected. Retries, JSON validation, limits and host queues are shared with GET. No authentication or application submission is performed. See [WAVE_B.md](WAVE_B.md).

Non-retryable HTTP errors and JSON/schema failures surface to ingestion. A challenge HTML page is an error, not job data. The application does not solve CAPTCHAs or fall back to another host automatically.

Wave C adds exact native JSON paths on `www.amazon.jobs` and `explore.jobs.netflix.net`, plus `HtmlTransport.getHtml` on Apple's public `/en-us/search` and `/en-us/details/<position>/<slug>` routes. HTML and JSON share the existing queue, pacing, retry and 32 MiB limit; HTML mode requires `text/html` and retains the raw body. Apple's internal JSON API and native account/application routes are rejected. Meta and Google are absent from the feed-fetch allowlist. See [WAVE_C.md](WAVE_C.md).

[Atlassian](ATLASSIAN.md) permits only JSON GET requests to `https://www.atlassian.com/endpoint/careers/listings`, without query parameters or fragments. Other paths, HTML requests and POSTs remain rejected. Validating outbound employer/application links does not authorize transport requests to its iCIMS application portals.

[Shopify](SHOPIFY.md) permits only HTML GET requests on `www.shopify.com/careers` and canonical title-slug/posting-UUID detail paths. Queries, fragments, `.data`, search/portal routes and application requests remain outside the fetch allowlist. HTML size, pacing, retry and timeout limits are shared with Apple. The original application URL is preserved as an outbound link and never fetched by ingestion.

## Tradeoffs and extension points

Official-site auditing uses a separate HTML/policy transport with employer/ATS/documentation
allowlists, public DNS-address checks, robots rules, redirect rejection, host pacing, bounded bodies
and elapsed time. It does not reuse the ATS JSON parser or bypass challenges. See
[AUDITING.md](AUDITING.md) for its exact policy and limitations.

Pacing is process-local. Multiple workers/transports may collectively exceed a provider's preferred rate, so broader concurrency requires shared limits. There is no conditional-request cache, ETag storage or request cancellation tied to graceful shutdown yet. A page traversal can exceed one request's timeout; the repository lease bounds publication ownership separately.

The EU Lever host is allowed for a future adapter/configuration extension; the current Lever adapter uses the global host. Add allowlisted hosts deliberately alongside source/provider support, not through arbitrary user-supplied fetch URLs. Do not duplicate retry loops inside adapters.

## Implementation and verification

[Transport port](../backend/src/ports/ingestion.ts), [HTTP implementation](../backend/src/infrastructure/http.ts), [HTTP behavior tests](../backend/src/infrastructure/http.test.ts). Successful live fetches are recorded in [SOURCE_CHECKS.md](SOURCE_CHECKS.md); source-access suitability is reviewed during [onboarding](SOURCES.md).
