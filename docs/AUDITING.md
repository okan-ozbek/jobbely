# Decision: evidence-backed source audits

**Status:** Audit workflow and publication gates implemented; Wave A approvals remain pending. Recorded 30 September 2026.

## Decision and rationale

Successful ATS traversal proves only what that feed advertised. Compare stable posting identities
with a contemporaneous official inventory, discover linked boards, and require documented employer
scope and access/display decisions before verification. Counts alone cannot establish correctness.

The workflow is an operator CLI, not a public crawl endpoint. It does not automatically interpret
legal terms, approve employer scope, bypass challenges, or enable incomplete sources.

## Commands

```powershell
pnpm audit:wave-a
pnpm audit:wave-b
pnpm audit:wave-c
pnpm --filter @jobbely/backend run audit --company discord
```

Audit needs internet access but no database. It fetches configured official pages, robots files,
policy/documentation URLs and ATS feeds without publishing listings. It continues after a failed
company and returns a nonzero exit code if any selected company has unresolved gates. Such an exit
is an audit finding, not necessarily a software failure.

Raw responses, HTML, policy documents and robots evidence for successful fetches are saved to
timestamped, ignored `backend/data/audits/<company>/<timestamp>/` directories. Failed requests retain
error metadata rather than response bodies. Compact durable reports live in
`backend/config/audit-evidence/<company>.json`: counts, exact mismatching IDs, discovered links,
requisition-variant evidence, policy hashes, representative links and blockers, without full raw
descriptions. These reports intentionally do not claim that inaccessible pages advertised zero jobs.

## What is checked automatically

- Official visible vacancy links are mapped to provider board and posting IDs. Repeated links to
  the same posting are deduplicated; different postings with identical titles are not merged.
- Both directions are checked: official IDs missing from the feed, and feed IDs absent from the
  official inventory. Matching counts with different ID sets fail.
- Embedded URLs establish board discovery only, not exhaustive listing enumeration. Discord's
  explicit board array is parsed from its official script, without executing JavaScript.
- A hosted board cannot establish its own employer attribution: a configured official employer
  page must link to it. Newly discovered unregistered boards block approval unless explicitly
  excluded with a scope reason.
- Pagination links/load-more controls must be accounted for in configured listing pages. A human
  reviewer must confirm worldwide, unfiltered traversal and mark each listing page `complete`.
  An empty JavaScript shell is not a zero-jobs result; zero requires a reviewed `emptySelector`.
- Every extracted vacancy is checked for a readable sanitized description, a nonempty title and
  an employer/board application link. Feed completeness and duplicate IDs are checked separately.
- Official HTML and policy retrieval respects robots rules for Jobbely. Missing robots responses
  (404/410) differ from failed/challenged robots responses, which block the audit. Permission in
  robots does **not** grant permission to republish descriptions.
- Published policy/documentation pages are captured and hashed as normalized readable text. An
  approved access review must reference the current document hashes and explicitly allow this
  application's full-description display. Changed or unavailable documents block approval.

### Legitimate location variants

The default comparison requires exact posting IDs. Mozilla's official page selects one posting
per role, while Greenhouse advertises additional location postings. Its plan explicitly opts into
`greenhouse_requisition_variants`. Extra postings are accounted for **only** when the same board's
raw feed proves a shared, non-null `internal_job_id` with an officially linked posting. Each
relationship is recorded as feed ID, official ID and requisition ID. Neither titles nor similar
descriptions are used as identity evidence, and storage still retains each distinct posting.

## Completing a review and enabling scheduling

Edit the relevant entry in `backend/config/source-audits.json` after examining the artifacts:

1. Confirm all relevant regions, hiring channels and legal entities. Record each channel as
   `included`, `excluded` with a reason, or `pending`. Included channels must name configured
   sources; add newly discovered boards as candidates first.
2. Confirm each listing page's traversal, selector and empty-state behavior; set `complete` only
   after checking them. Use all required pages, not a default filtered view.
3. Set `scope.status` to `approved` only when the company scope is justified. Record `reviewer`,
   ISO `reviewedAt`, evidence URLs and substantive notes.
4. Review the captured access documents for automated retrieval and description display. Record
   `access.reviewedDocuments` entries with their URL and report `textSha256`. Set `access.display`
   to `private_full_descriptions` or `public_full_descriptions` only when appropriate, and record
   reviewer, timestamp, notes and `access.status: "approved"`. Public API documentation alone
   does not prove unrestricted employer-description licensing. `links_only` or `blocked` cannot
   authorize this application's current full-description publishing behavior.
5. Rerun the audit. Do not approve unexplained feed-only/official-only IDs or inaccessible scope.
6. Activate **only passing companies**:

   ```powershell
   pnpm --filter @jobbely/backend run audit --company discord --activate
   ```

   `--wave A --activate` is also available, but every selected company must pass. Activation is
   all-or-nothing for the selected cohort; it never promotes a partially passing batch. It validates
   current evidence/configuration, sets `auditStatus: "verified"` and `scheduled: true`, and replaces
   the source configuration atomically. Normal audits never change those flags.

7. Restart affected API/worker processes, sync the verified sources and run the separate worker:

   ```powershell
   pnpm --filter @jobbely/backend run sync --all-enabled
   pnpm --filter @jobbely/backend run worker
   ```

The worker's existing UTC schedules refresh enabled sources twice daily. It is not started by the
audit command or `pnpm dev`; unattended queue recovery still requires operational validation.

## Runtime invariants

Registry loading rejects verified sources without passing evidence for **all configured company
sources**, bound to the current board/provider configuration and audit plan. Evidence and reviews
expire after 30 days; future-dated evidence is rejected. Use the audit CLI to renew evidence even
when normal registry loading refuses expired verification.

Bootstrap injects a `PostingValidation` port into `SyncSource`. Before publishing any verified
refresh, it revalidates audit evidence, retrieves current official inventories and policies, and
reconciles the extracted source again. A mismatch, new board, challenge, policy change or unreviewed
scope fails the run before publication. Existing jobs and removal counters are preserved, and
coverage reflects the failed run. Successful reconciliation evidence is stored with the database
snapshot. Candidate manual imports remain available for investigation but cannot reconcile closure.

Enterprise source endpoint, canonical host aliases and employer membership rules are included in the configuration hash. Workday official URL slugs are reconciled to immutable posting IDs through captured detail evidence, rather than inventing requisition/title equivalence. The expanded registry includes pending plans for every Wave B company; a configured plan is not an approval. See [WAVE_B.md](WAVE_B.md).

The five Wave C priorities also have pending plans. Native Apple/Amazon/Netflix URLs establish posting identity through their public posting numbers, with an explicit `PIPE-` mapping for Apple's managed retail records. Meta and Google remain access-blocked. Native search pagination/HTML collection still needs reviewed official traversal before activation can pass. See [WAVE_C.md](WAVE_C.md).

## Tradeoffs and limits

- Plans are explicit, operator-reviewed source configuration, not a universal autonomous crawler.
  New custom/native URL patterns or JavaScript-only boards need additional collectors or reviewed
  evidence strategies. The current native wrapper collector supports Mozilla's Greenhouse links.
- Scope and access approval require actual review. The software enforces attribution, decisions,
  document hashes and freshness; it does not provide legal clearance or discover every unlinked
  regional/entity channel automatically. Review the report's discovered links and relevant official
  navigation, including known Foundation/Thunderbird channels.
- Official and ATS sites can update at different times. A discrepancy remains blocked rather than
  being excused by a percentage tolerance; investigate/retry and document source-native variants.
- Network access uses exact trusted employer/ATS/documentation hosts, HTTPS, no credentials/ports,
  public DNS-address checks, no redirects, one request per host per second, robots crawl delay,
  30-second requests, 8 MiB page/1 MiB robots limits and a four-minute official-fetch budget. DNS
  checks are not connection-pinned; deployment egress controls remain recommended. Official HTML
  requests have no automatic retries; 403/429 are not bypassed.
- Candidate imports are not subject to the verified publication guard. No source is approved merely
  by setting a JSON flag, and no source has been enabled while its audit still has blockers.
- Source state requires process restart, and expired/missing evidence prevents normal startup with
  verified configuration. Restore valid evidence or explicitly downgrade the source before restart.

## Implementation and verification

[Audit plans](../backend/config/source-audits.json), [audit CLI](../backend/src/cli/audit-source.ts),
[auditor](../backend/src/infrastructure/audits/auditor.ts),
[identity comparison](../backend/src/infrastructure/audits/reconcile.ts),
[evidence gates](../backend/src/infrastructure/audits/model.ts),
[official transport](../backend/src/infrastructure/audits/official-http.ts),
[runtime validation](../backend/src/infrastructure/audits/validation.ts),
[workflow tests](../backend/src/infrastructure/audits/auditor.test.ts),
[transport tests](../backend/src/infrastructure/audits/official-http.test.ts),
[publication-failure tests](../backend/src/application/sync-source.test.ts).
Live findings belong in [SOURCE_CHECKS.md](SOURCE_CHECKS.md), not a permanent completeness claim.
