# Decision: shared bounded public transport

**Status:** Implemented for the three public API adapters, 30 September 2026.

## Decision and rationale

Provider adapters use the `JsonTransport` port. `PublicJsonTransport` owns request policy so pacing, retry and destination rules do not diverge between adapters. Fake transports make provider tests deterministic.

## Implemented policy

| Concern            | Behavior                                                                                |
| ------------------ | --------------------------------------------------------------------------------------- |
| Destinations       | HTTPS only; exact allowlist of Greenhouse, Ashby, global Lever and EU Lever API hosts   |
| URL constraints    | No credentials or explicit port; redirects fail rather than being followed              |
| Concurrency/pacing | One in-flight request per host per transport instance; starts at least one second apart |
| Timeout            | 30 seconds per attempt                                                                  |
| Retries            | At most four attempts for transient network/type/timeout errors and HTTP 429/5xx        |
| Backoff            | Exponential delay; rate-limit/server retries add small jitter                           |
| Retry-After        | Seconds or HTTP date honored; delays over 30 seconds fail this run for later retry      |
| Body               | JSON content type required; streamed size bounded to 32 MiB                             |
| Evidence           | Requested URL, fetch timestamp and parsed JSON returned together                        |

Non-retryable HTTP errors and JSON/schema failures surface to ingestion. A challenge HTML page is an error, not job data. The application does not solve CAPTCHAs or fall back to another host automatically.

## Tradeoffs and extension points

Pacing is process-local. Multiple workers/transports may collectively exceed a provider's preferred rate, so broader concurrency requires shared limits. There is no conditional-request cache, ETag storage or request cancellation tied to graceful shutdown yet. A page traversal can exceed one request's timeout; the repository lease bounds publication ownership separately.

The EU Lever host is allowed for a future adapter/configuration extension; the current Lever adapter uses the global host. Add allowlisted hosts deliberately alongside source/provider support, not through arbitrary user-supplied fetch URLs. Do not duplicate retry loops inside adapters.

## Implementation and verification

[Transport port](../backend/src/ports/ingestion.ts), [HTTP implementation](../backend/src/infrastructure/http.ts), [HTTP behavior tests](../backend/src/infrastructure/http.test.ts). Successful live fetches are recorded in [SOURCE_CHECKS.md](SOURCE_CHECKS.md); source-access suitability is reviewed during [onboarding](SOURCES.md).
