# Proposal: private resume processing and upload isolation

**Status:** Proposed; required before public upload release. Recorded 1 October 2026, Europe/Amsterdam. Feature scope: [RESUME_PLAN.md](../RESUME_PLAN.md).

## Decision and rationale

MVP analyses are transient: raw documents are processed in bounded memory, results remain in the current browser tab, and matching requests are stateless. Persist public job features only. Accounts, saved resumes, private object storage and durable candidate queues are deferred. This avoids introducing anonymous permanent personal-data records while the product has no authentication or deletion infrastructure.

This is a new trust boundary beyond today's [read-only API](API.md) and [provider-content rules](SECURITY.md). Uploading privately chosen documents authorizes parsing for this feature, not analytics reuse, model training, employer contact, profile enrichment or sharing with third parties.

## Data lifecycle

| Data                                   | Proposed handling                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Original bytes/filename                | Bounded parse request/subprocess memory only; do not save to disk or log the supplied filename            |
| Extracted text/contact details         | Return to the requesting tab; keep only while viewing/reviewing; display-only contact fields              |
| Corrected profile/preferences          | React tab memory; send only allowlisted matching fields, not contact details/full document                |
| Candidate evidence excerpts in results | Private response/tab memory, never observability payloads                                                 |
| Job features                           | PostgreSQL projection of already stored employer descriptions; follows public job lifecycle/versioning    |
| Operational metrics                    | Format, coarse size band, duration, capacity/error code and counts only; no content or identifying labels |

Do not store candidates in PostgreSQL, object storage, pg-boss, browser localStorage/sessionStorage/IndexedDB or service-worker caches. Closing/reloading the tab loses the analysis. Clear/cancel releases browser references and terminates active parser work; it cannot promise cryptographic erasure of OS memory, swap or crash dumps. Harden hosting to disable body capture and diagnostic dumps containing private buffers; avoid swap or encrypt it where appropriate.

Do not record private body values, multipart payloads, candidate hashes or evidence excerpts in logs, APM traces, analytics, error-reporting attachments or network-debug artifacts. Request/profile fingerprints are transient pagination state, not telemetry identifiers. Generic errors must not quote resume text. Set private endpoint responses to `Cache-Control: no-store`; exclude these endpoints from proxy/CDN/body caches and recorders.

## Upload boundary and limits

Provisional limits to confirm in the spike:

- One PDF or DOCX per request, maximum 5 MiB compressed input and 20 PDF pages; pasted text at most 100,000 characters.
- DOCX archive validation before conversion: maximum 25 MiB expanded bytes and 1,000 entries, bounded per-entry size, no traversal/symlink/external-file extraction and no macros or embedded executables. Reject inconsistent type/signature/package structure.
- Maximum extracted text 100,000 characters, bounded spans/employment/skill records, and strict profile/matching payload schemas. Explicitly reject oversize rather than silently truncate evidence used for matching.
- Hard parse wall-clock timeout 30 seconds, process memory target 512 MiB, initial two concurrent parsers per instance and a bounded admission queue; cancel/terminate on timeout/disconnect. Process/container limits must enforce memory, not rely only on JavaScript heap settings.
- Proposed per-client admission budget ten analysis requests per minute, plus a global capacity cap; tune on measured hardware. Matching also has request/CPU/rate limits. Identify clients through deployment-controlled trusted proxy settings, not spoofable forwarded headers.

Browser extension and multipart MIME values are hints, not validation. Validate signatures and DOCX package structure with bounded decompression. Reject encrypted PDFs, image-only documents, unsupported archives and unreadable files with a recoverable text-paste option. Never fetch a resume URL supplied by a user. Do not execute embedded scripts/macros, follow document links, load remote resources or enable external file access.

[OWASP's upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) supports layered type/size validation and isolation; it is not satisfied by checking a filename extension. The library spike must prove that archive limits apply before an unbounded parser expansion can happen.

## Parser execution and rendering

Run Node parsing in a separate constrained process under a low-privilege identity with no network egress and no accessible secrets/application data; an ordinary subprocess alone does not establish filesystem isolation. Infrastructure/bootstrap owns the runner. Container/OS policy must enforce the boundary on the deployment platform. Do not pass the API process's credential-bearing environment through to the parser. Bounded IPC carries input/output; private bytes are not worker-queue messages.

If portable public-hosting isolation cannot be demonstrated, restrict uploads to local development and ship pasted-text matching first until the boundary is ready. This is a release gate, not a requirement to ask for approval before building the local feature.

Use text nodes for resume evidence; do not mount document HTML or third-party converted markup into the app. [Mammoth's security documentation](https://github.com/mwilliamson/mammoth.js) warns about unsafe links, external references and resource exhaustion. Its external file access must remain disabled. A future PDF visual preview needs its own resource/network policy; do not automatically render arbitrary files in an iframe in this MVP.

Private POST endpoints require HTTPS in hosted mode, restricted configured browser origin, strict content types/body limits, origin checks and correct proxy configuration. CORS is not authentication or rate limiting. Since no account/profile is persisted, there is no public profile-ID lookup route; matching responses go only to the initiating request. Future saved profiles require authenticated ownership checks, explicit retention/deletion behavior, encrypted storage/backups and a separate documented privacy review before shipping.

## Verification and implementation links

Current integration points are [API](../backend/src/api/app.ts), [bootstrap](../backend/src/bootstrap.ts), [frontend hooks](../frontend/src/hooks/) and [deployment](DEPLOYMENT.md). The runner/upload endpoints are proposed additions in [the plan](../RESUME_PLAN.md), not current safeguards.

Before public release, verify resource enforcement, archive bombs, parser crashes, disconnected requests, bounded queues, external resource denial, file traversal, error/body-log leakage, browser clearing and reverse-proxy cache/body capture configuration. Use controlled synthetic attack fixtures. Assert that no candidate content enters database/queue/storage. Measure retained memory after cancellation under load; memory-reference release does not imply physical erasure.

Documentation and automated tests must state the actual retention/isolation behavior. Avoid promises such as "never leaves your device" because parsing uses the backend. The UI should say the document is sent to Jobbely for temporary processing and is not saved as a resume/profile by this feature.
