# Decision: transient profiles and local document isolation

**Status:** Text analysis, stateless matching and local PDF/DOCX extraction implemented. Recorded 1 October 2026, Europe/Amsterdam. This supersedes the proposed server-upload/subprocess design; server document uploads remain unsupported.

## Boundary and rationale

Original file bytes remain on the candidate's device. A dedicated browser worker extracts bounded text and reading blocks; after reviewing that text the candidate explicitly requests temporary backend analysis. This avoids exposing the API's filesystem, environment and database credentials to a document parser. Matching accepts only a small structured profile, never the full document or contact fields.

React memory holds input, original reading blocks, corrections and results. No candidate database table, disk file, browser storage, service-worker cache, object store or candidate queue is created. Full reload/closing the tab clears state; SPA navigation retains review. Clear, replacement, cancellation and unmount abort work and release references. This does not promise physical erasure from browser memory, OS swap, crash dumps or client diagnostics.

## Enforced limits

| Boundary          | Limit                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| File              | One active worker per workbench; 5 MiB compressed input                                                        |
| PDF               | 20 pages; no OCR, password input or rendering; 10,000 text items/page                                          |
| DOCX              | 1,000 entries, 25 MiB declared expansion, 5 MiB/entry; bounded streaming inflation and CRC validation          |
| Reading output    | 100,000 characters, 2,000 blocks, 2,000 characters/block                                                       |
| Document duration | 30 seconds, including isolation verification and file reading; terminate worker on timeout/cancel              |
| Analysis          | 768 KiB JSON, 100,000 characters, 2,000 lines, 2,000 characters/line; correction arrays at most 100            |
| Matching          | 256 KiB strict JSON, 200 skill claims, 100 roles; bounded feature scan as described in [MATCHING](MATCHING.md) |

Signatures and ZIP structure are checked rather than trusting extensions or MIME. DOCX rejects unsafe paths, symlinks, duplicates, encryption, unsupported compression, macros/embedded executables, malformed XML, DTD/entities and external relationships (including encoded values). Nothing is unpacked to a filesystem or fetched from document references. XML yields plain text only; no DOCX HTML is rendered. PDF scripting/XFA, image rendering, external font/wasm loading and OCR are unused/disabled.

Browser memory remains managed by the browser. **There is no enforced 512 MiB per-document OS/process ceiling.** Input/output/archive/complexity bounds and worker termination reduce resource risk, but compressed PDFs can allocate internally before post-parse bounds apply. A hardened server/container parser with enforced memory and egress limits remains a separate future decision if server parsing is introduced. Do not claim an ordinary Node subprocess provides that sandbox.

## Worker CSP and hosting

The production parser is one bundled `assets/document-parser-*.js` asset. Its response must include:

```text
Content-Security-Policy: default-src 'none'; script-src 'none'; connect-src 'none'; worker-src 'none'
Cache-Control: no-store
```

The worker cannot fetch, connect, load further scripts, evaluate script strings or create workers under that policy. It has no DOM or Node APIs. The browser's renderer sandbox supplies the local execution boundary; this is not a claim of a separate OS process per document. The main app performs an anonymous HEAD request to verify the worker policy **before reading private bytes** and refuses files if it is absent/relaxed. Configure matching headers on HEAD and GET at the host.

[Vite](../frontend/vite.config.ts) sets the strict policy for production preview. Development workers need `script-src 'self'` for Vite's module imports, while `connect-src` and `worker-src` remain `'none'`; this development exception is rejected in production. [The static `_headers` file](../frontend/public/_headers) supports hosts that understand that format; other hosts must configure it explicitly. See [DEPLOYMENT](DEPLOYMENT.md).

## API and observability

Both private POST routes return `Cache-Control: no-store`, reject unexpected browser origins, use generic non-reflecting errors and bypass private exception logging. Admission is 60/minute for review analysis and 15/minute for matching, using actual connection IP with at most 1,000 windows per route. Untrusted forwarded IPs cannot bypass the limit; a shared reverse proxy needs explicit edge enforcement. Origin/CORS are not authentication.

Do not enable proxy/CDN caching, request-body recording, APM payloads, candidate fingerprints or document/resume attachments in diagnostics. Backend access logs contain route/status/timing, not submitted bodies. Use HTTPS in production. Input may contain private text intentionally chosen for analysis; it must not enter fixtures, committed files or operational logs. Employer labels/location remain private structured input even though contact fields are excluded.

## Verification

[Document adapters/session](DOCUMENTS.md), [API guard](../backend/src/api/private-resume-route.ts), [review state](../frontend/src/features/resume/useResumeAnalysis.ts), [matching UI state](../frontend/src/features/resume/ResumeMatches.tsx), [test guide](RESUME_TESTING.md).

Synthetic tests cover no-store/origin/rate/schema rejection, unchanged candidate-free repository state, archive bounds, encoded external relationships, encrypted/image-only PDF rejection, matching invalidation, isolation preflight, cancellation before/during reading, ignored late/readiness messages and timeout termination. Browser verification must also exercise production worker headers and real adapters; unit fakes alone do not establish deployed CSP enforcement.
