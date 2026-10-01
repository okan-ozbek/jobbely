# Decision: local PDF and DOCX adapters

**Status:** Implemented 1 October 2026, Europe/Amsterdam. Supported: text-layer PDF and standard WordprocessingML DOCX. No OCR or server upload endpoint.

## Choice and abstraction

Use PDF.js for PDF text positions and fflate plus fast-xml-parser for bounded ZIP/XML DOCX reading. Both format adapters return `ExtractedDocument`: format, text, ordered blocks (page or paragraph/table/header/footer) and warnings. They share input/output limits; they do not share an inheritance tree because their layout/evidence differs.

[PDF.js](https://mozilla.github.io/pdf.js/) supplies text extraction; its legacy build supports the declared Node 24 test runtime as well as current browsers. [fflate](https://github.com/101arrowz/fflate) supplies streaming inflation; [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) reads validated XML while preserving element order. Installed versions are locked in [pnpm-lock.yaml](../pnpm-lock.yaml); all parser code is bundled locally, without a CDN. DOCX conversion does not need HTML or external file resolution.

The [session reader](../frontend/src/features/resume/documents/reader.ts) accepts worker/isolation capabilities for deterministic cancellation tests. The [React hook](../frontend/src/features/resume/documents/useDocumentInput.ts) owns one AbortController/session and only commits current results. The [worker](../frontend/src/features/resume/documents/document.worker.ts) owns parsing; main-thread code verifies CSP before reading bytes. PDF.js readiness messages are ignored until the actual document response. All failures are generic, with no private exception payloads.

## Reading order and limits

PDF groups positioned words by baseline, sorts within rows, and infers two columns when enough separated rows support them. It reads a left column before the right column within bands separated by spanning headings. The midpoint heuristic can misread asymmetric columns, sidebars or poorly encoded fonts; warnings and editable text are necessary. Fragmented text remains visible rather than inventing missing words. Every block has a page number.

DOCX follows document XML order, prepending headers and appending footers once. Tables produce row blocks with cells separated by `|`. Headings/paragraphs remain text; floating shapes and unconventional namespaces/layouts can need corrections. External hyperlink relationships are rejected, including ordinary resume links stored as external relationships; remove links or paste visible text. Text URLs alone are not fetched.

Input limits, ZIP preflight, streaming inflation, CRC/size checks, entity/external-reference rejection, worker CSP and timeout/cancellation are owned by [RESUME_PRIVACY](RESUME_PRIVACY.md). Image-only and encrypted PDFs return recoverable paste-text guidance. File selection does not automatically send the extracted text; the candidate clicks Analyze after inspecting it.

## Hosting and verification

Serve production worker headers from [_headers](../frontend/public/_headers) or the equivalent [reverse proxy configuration](DEPLOYMENT.md). Missing isolation headers fail closed to pasted text. The browser has resource bounds and termination, but no enforceable per-document 512 MiB process budget.

[PDF adapter/order](../frontend/src/features/resume/documents/pdf.ts), [DOCX adapter](../frontend/src/features/resume/documents/docx.ts), [shared model/limits](../frontend/src/features/resume/documents/model.ts), [synthetic fixtures/tests](../frontend/src/features/resume/documents/documents.test.ts), [session tests](../frontend/src/features/resume/documents/reader.test.ts).

Run `pnpm --filter @jobbely/frontend test`. Tests cover equivalent single-column PDF/DOCX, column/header order, table rows, broken words, empty/image-only PDF, encrypted/damaged/oversized/page limits, malformed ZIP/XML, entry/output bounds, CRC, entities/external links, CSP preflight and cancellation/timeout. Browser checks must use both development and production preview because their script policies differ. Production deployment and independent security/load review remain separate checks.
