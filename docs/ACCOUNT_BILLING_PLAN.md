# Plan: accounts, tiers, Stripe subscriptions and administration

**Status:** Account foundation implemented; remaining delivery phases proposed, 5 October 2026, Europe/Amsterdam. [ACCOUNTS](ACCOUNTS.md) documents implemented behavior and verification. The five-result paywall, Stripe integration, admin dashboard and analytics are not yet enabled.

**Confirmed product choices:** Visitors can analyze a resume and see their top five matches without an account. An account is required to upgrade. Pro is **US$7.95 monthly** (795 USD minor units). The user selected application-owned accounts with email/password registration, optional username, email verification codes, GitHub and LinkedIn sign-in instead of a separate managed-auth supplier. Generic SMTP delivery uses a separate queue worker. Merchant/tax/commercial terms remain open.

**Administration scope:** Authorized admins can remove companies and jobs from public display and manage pricing tiers through a private dashboard. Removal is reversible unpublishing; source identities and ingestion evidence remain intact.

This is a new product increment beyond the original [MVP exclusions](../MVP_PLAN.md). Existing matching and resume privacy behavior remains implemented as documented in [MATCHING](MATCHING.md) and [RESUME_PRIVACY](RESUME_PRIVACY.md). The existing company-directory changes are independent of this plan.

## Product and tier boundaries

Start with Free and Pro. Guest and signed-in Free users have the same matching access; registration alone does not unlock more results. Keep capabilities separate from commercial plan names so later tiers do not require scattered checks for `plan === 'pro'`.

| Capability                                                 | Guest / Free                                        | Pro monthly                            |
| ---------------------------------------------------------- | --------------------------------------------------- | -------------------------------------- |
| Company directory, job catalog, employer links             | Public                                              | Public                                 |
| Local resume reading, analysis and profile correction      | Included                                            | Included                               |
| Ranked resume recommendations                              | Top five per current profile and function selection | All eligible ranked results, paginated |
| Match explanation and description highlighting             | For those five results                              | For any available job                  |
| Billing and account management                             | Account required to subscribe                       | Included                               |
| Saved resumes, matching history, alerts, auto-applications | Outside this increment                              | Outside this increment                 |

“All results” means results admitted by existing source, freshness, capacity and matching policies. Payment never changes ranking, evidence quality, eligibility or the 36-hour source checks. Pro is not a promise of unlimited computation; existing processing bounds and admission controls still apply.

The free limit is five results per matching context, not five lifetime results. Editing the resume or changing the function selection reranks the preview. Visitors can discover different jobs through different inputs and the public catalog. This intentionally sells personalized ranking and comparison access, not exclusive access to public employer vacancies. A lifetime or daily quota would need a separate product decision and identity/usage tracking.

When more than five results exist, show five real cards followed by one upgrade panel: “Unlock all your matches”, the approved monthly price, and a clear recurring-billing statement. Return `hasLockedResults` rather than hidden job records. Avoid fabricated blurred jobs and a claimed match count derived from `eligible` or `evaluated`, which currently count scanned postings rather than validated good fits. If five or fewer results exist, do not imply additional results are waiting behind the paywall.

## Registration and login

Use application-owned users and revocable sessions with **email/password registration, GitHub OAuth and LinkedIn OpenID Connect**. Native registration has an optional display username and requires a six-digit email verification code. Password recovery uses a separate code flow. [EMAIL_ACCOUNTS](EMAIL_ACCOUNTS.md) records implemented hashing, limits and the independently runnable generic-SMTP queue worker. No managed-auth service is required. Provider app registration, credentials and exact callback URLs are still required for SSO.

Request only identity/email permissions. Map accounts by stable issuer/subject, never mutable usernames or matching emails. Only explicitly verified provider email is stored; missing/unverified email stays null. A verified billing-contact requirement needs its own workflow before Checkout. See [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) and [LinkedIn OIDC](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2).

Proposed flow and controls:

1. Sign-in/upgrade opens an inline account dialog. Native registration, code confirmation, login and reset stay in the dialog. SSO starts a browser-bound, one-time ten-minute OAuth attempt, then opens the provider through a separately clicked link. The original resume tab stays mounted. Native credentials never automatically link to SSO by email; account linking is deferred.
2. The backend exchanges the code, verifies GitHub's current numeric identity or LinkedIn's signed OIDC identity/nonce/userinfo subject, then maps issuer/subject to a local user. GitHub uses S256 PKCE. Wrong-browser/provider, tampered, expired or replayed callbacks fail before session issuance. Provider tokens are not retained.
3. Issue an opaque application session in a Secure, HttpOnly, SameSite=Lax cookie. Store only a hash of the session secret in PostgreSQL. Implemented limits: seven days idle, thirty days absolute, renewed only within that absolute limit. Provider credentials stay in infrastructure; no authentication token is placed in a resume URL.
4. Authenticated mutations require the session, exact allowed origin and CSRF protection. Backend billing/authorization decisions never trust a frontend user ID, plan, customer ID or role. Session and billing reads return `no-store`.
5. Logout revokes the application session and clears private workbench state and paid result cards. Account deletion revokes all sessions and handles the subscription before removing login access. Reauthentication is required for deletion or other sensitive account changes.

Keep provider calls in bounded backend adapters with fixed HTTPS endpoints, timeouts and redirect rejection. Auth route logging is disabled to exclude callback codes/state and private errors. The original tab refetches the server account on focus; closing/discarding it still loses the resume. Authentication receives identity fields only, never resume text, filenames or match evidence. Use [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

## Enforce access on the backend

Current [matching routes](../backend/src/api/matching-routes.ts) are anonymous. The [input schema](../backend/src/api/matching-schemas.ts) lets callers request up to fifty results and provide a cursor. [MatchJobs](../backend/src/application/resume/match-jobs.ts) signs cursors and binds them to the profile, preferences and dataset, but does not bind them to account access. The single-job comparison route currently scores any supplied public job ID. Hiding cards in React would therefore be bypassable.

Implement one application-owned access policy around ranking, pagination and single-job comparison:

- Anonymous or Free requests use a server-selected limit of five; a larger requested limit cannot widen access. Reject pagination for Free even if the caller submits a valid old Pro cursor. Compute enough internally to establish `hasLockedResults`, but serialize only the five allowed records and no next-page cursor.
- Return a short-lived signed preview receipt identifying only those five public job IDs, a keyed fingerprint of the reviewed matching context, dataset/version information, expiry and guest/session binding. It contains no resume excerpts or profile JSON and is kept only in tab memory. Use a distinct signing purpose from pagination; reject tampering, expiry, profile changes or another session's receipt.
- Free single-job comparison requires a matching preview receipt containing that job ID. Without it, return a typed `upgrade_required` response without scores, evidence or highlighted matches. Public descriptions and requirements remain readable. This closes the route that would otherwise let a caller enumerate personalized comparisons for the entire catalog.
- Pro requests resolve entitlement on every request, including pagination and comparison. Extend paid cursor signatures with account binding and access-policy version; recheck current entitlement even when the cursor is valid. Downgrade invalidates further paid responses.
- An absent session is Guest; an invalid or expired supplied session is an authentication error, not an implicit paid user. An entitlement lookup failure returns a retryable error for protected access and never unlocks Pro. Public catalog and anonymous preview remain independently available.
- Frontend access state is explanatory UI only. Do not ship locked IDs, scores, descriptions or evidence as hidden JSON/DOM data. Prevent private result caching and redact receipts, cookies and authorization headers from logs.

Guest binding can use a short-lived HttpOnly preview-session cookie. It is not an account and does not persist a resume. If login rotates its binding, rerun matching with the in-memory reviewed profile to issue a new receipt. Apply distributed admission controls to bound reranking abuse; the current per-process IP limiter is insufficient across multiple production instances.

## Stripe integration and payment flow

Use Stripe Billing with an initial Pro product, one published monthly recurring Price revision and Stripe-hosted Checkout. The admin pricing workflow below publishes new revisions and can introduce tiers backed by implemented capabilities. Use the Customer Portal for card updates, invoices and cancellation. This avoids building payment forms. Stripe supports server-created Checkout Sessions and hosted subscription management. [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions), [Customer Portal](https://docs.stripe.com/customer-management).

1. Authenticated `POST /api/v1/billing/checkout` resolves the user and creates/reuses their unique Stripe Customer. The client can select a published plan key; only the server resolves its current Price revision, currency, quantity and return URLs. Send the internal user reference and billing identity; never send a resume or skill metadata. Reject client-supplied prices, unpublished plans, arbitrary return URLs and other users' customer IDs.
2. Reuse a pending attempt for double clicks and network retries, with database uniqueness/locking and Stripe idempotency keys for customer and Checkout creation. Direct current subscribers to Manage subscription. Block new purchases while a past-due subscription needs repair. Expire or reconcile abandoned attempts before allowing another to avoid duplicate subscriptions. [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests), [duplicate-subscription controls](https://docs.stripe.com/payments/checkout/limit-subscriptions).
3. Open Checkout in a separate tab/window while the original resume tab remains mounted. Prefer a user-clicked link once the session URL is ready so popup blocking does not lose the flow. Return to a billing-status page that contains no private profile. That page can report success, but does not grant access.
4. The original app refetches its own entitlement on focus and uses bounded polling while payment is pending. Treat cross-tab messages as a prompt to refetch, not payment evidence. After verified activation, rerun the reviewed profile with Pro access and replace the preview with ranked pagination. A changed public dataset may change the order; do not promise a frozen ranking.
5. If the original tab was closed, reloaded or discarded, the subscriber remains subscribed but must reinsert the resume. Explain this before payment. Do not silently introduce browser profile storage to survive redirects. An embedded Checkout fallback could be evaluated later if mobile tab retention proves unreliable.

The hosted success URL, an editable query parameter and `checkout.session.completed` alone are not proof of a paid subscription. Verify customer ownership, the allowed product/Price, current subscription state and the settled invoice through the server. Account creation succeeds independently of payment; canceled or failed Checkout leaves the account on Free.

## Entitlements, renewals and cancellation

Stripe is the billing source of truth. Store a small local access projection for fast matching checks and synchronize it through verified events plus reconciliation. Start with a pure local capability policy; a separate Stripe Entitlements product mapping is optional for future multiple paid products, not another source of truth required for two tiers.

| Billing condition                                               | Proposed access                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| No subscription, abandoned Checkout, incomplete first payment   | Free                                                                            |
| Verified settled Pro invoice and active subscription            | Pro through the purchased coverage end                                          |
| Scheduled cancellation                                          | Pro through the paid period; Free afterwards                                    |
| Renewal pending / `past_due`                                    | Keep only previously paid coverage until it expires; no additional grace in v1  |
| `unpaid`, `paused`, ended/canceled subscription                 | Free; scheduled cancellation is handled before the subscription actually ends   |
| Full refund for the currently covered period or payment dispute | Suspend the affected paid entitlement pending reconciliation/support resolution |
| Partial refund                                                  | Keep access unless an explicit operator decision changes it                     |

No free trial, coupons, annual plan or proration is proposed for v1. Do not infer paid coverage solely from the subscription's upcoming billing period or `active` status: Stripe explains that an active subscription does not prove every invoice has been paid. Normalize settled coverage and renewal state from the pinned API version. Resolve entitlements against known historical plan/Price revisions as well as the current published one so grandfathered subscribers remain supported. Zero-value promotional invoices, manual collection and arbitrary subscription products do not automatically grant paid capabilities. [Subscription statuses](https://docs.stripe.com/billing/subscriptions/overview).

Expose Manage subscription and the access-end date. Configure period-end cancellation in the Portal and a payment-repair action for failures. Refunds and subscription cancellation are separate operations; support tooling must explicitly reconcile both. Closing an account must not leave a renewing subscription with no owner able to cancel it.

## Webhooks and reconciliation

Create a dedicated Fastify webhook route that preserves raw request bytes for signature verification. It is authenticated by Stripe's signature, not by a browser session/CSRF token. Reject invalid signatures and unexpected live/test environment identifiers. Pin the Stripe SDK/API and event endpoint versions at implementation time. [Stripe webhook guidance](https://docs.stripe.com/webhooks).

Subscribe initially to `checkout.session.completed`, `checkout.session.expired`, relevant asynchronous Checkout payment outcomes, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.finalization_failed`, and refund/dispute events. Finalize the exact set for enabled payment methods; do not subscribe to unrelated events without a handler. [Subscription webhook lifecycle](https://docs.stripe.com/billing/subscriptions/webhooks).

After signature validation, durably insert an inbox record containing unique event ID, type, mode and allowlisted object references, then acknowledge. Do not acknowledge before durable storage or retain entire event bodies by default. A dedicated billing worker processes/retries the inbox; reuse the existing PostgreSQL queue approach, but do not depend on the optional ingestion scheduler being enabled. Return a non-success response if durable acceptance fails so Stripe retries.

Stripe can redeliver events and does not guarantee their order. Serialize reconciliation per customer/subscription, fetch current Stripe state, then atomically update the local projection and processed inbox marker. Repeated logical updates must be idempotent even if they arrive with different event IDs. Never use event timestamps alone as an ordering guarantee. Expired leases and bounded retry/backoff need database tests; permanent failures enter an operator-visible queue.

Reconcile active/pending/past-due subscriptions periodically and on the authenticated Checkout return path. Both paths use the same serialized update logic as webhooks. If Stripe is unavailable, already verified paid coverage remains valid until its recorded end; do not grant or extend unknown coverage. Monitor inbox age, reconciliation failures, customer/subscription mismatch, duplicate-purchase attempts and payment-to-unlock delay without recording candidate input. No payment-provider request should occur for every ranked job.

## Admin dashboard

Provide a private `/admin` area with Companies, Jobs, Pricing tiers, Analytics and Activity views. Activity is the admin audit trail; Analytics reports audience/product/billing aggregates defined in [ANALYTICS_PLAN](ANALYTICS_PLAN.md), including registered accounts, observed DAU/WAU/MAU, conversion, retention and subscription metrics. Each management view has search/filter controls, current state, a before/after preview for changes and clear success/failure feedback. Public signup or a paid subscription never grants administrator access. Admins receive no access to candidate resumes or transient profiles.

### Permissions and audit trail

Use server-owned grants for `catalog.manage` and `pricing.manage`. A catalog editor can moderate companies/jobs; a billing administrator can manage pricing; an operator may grant both. Provision the first administrator through an audited operator-only setup command tied to a verified identity, with no public bootstrap endpoint or self-assigned role. Role management in the dashboard is outside v1.

Add independent `analytics.read` and `billing.analytics.read` grants for aggregate usage and revenue views. Managing listings or prices does not automatically grant reporting access; no grant exposes a candidate profile or raw analytics export.

Admin access requires independently verified MFA/step-up. GitHub/LinkedIn login alone does not prove a recent MFA challenge; application-owned WebAuthn or TOTP is a proposed next decision, not implemented. A recent challenge is required for price publication or bulk removal. Recheck grant/session validity on every admin request, enforce CSRF, and revoke removed grants promptly. Hiding navigation is not authorization. Follow [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

Every change requires a reason and records actor, action, target, before/after values, UTC timestamp, correlation ID and outcome in an append-only audit trail. Successful local mutations and their audit entry commit together. Failed external pricing actions also retain a safe outcome record. Do not log resume data, session secrets, card information or complete Stripe payloads. Use optimistic revisions to reject stale edits; a second admin must reload rather than silently overwrite another's change.

### Remove and restore companies and jobs

“Remove” unpublishes a company or job. It does not delete the registry, posting history or source evidence, or claim that an employer closed the vacancy. Store a persistent moderation override keyed by the stable company slug or posting ID, independently of [source lifecycle](LIFECYCLE.md).

- Unpublishing a company hides its directory card and every associated job from catalog searches, facets, counts, recommendations, requirements and public detail/comparison routes. Preview the affected job count before confirmation. A public deep link to a hidden item returns a generic not-found response without revealing its details.
- Removing a job hides only that posting and preserves the company and other jobs. The rule is tied to its stable identity, so later imports or feature backfills cannot republish it. Duplicate postings with different source IDs require separate selection; do not suppress unrelated jobs by title.
- Restoring a company does not restore jobs individually removed earlier. Restoring a job does not override a hidden company or bypass the job's active status, source availability, audit or freshness gates.
- The admin UI shows both moderation state and underlying source/lifecycle state. Imports continue to maintain evidence; pausing ingestion, changing audit approval and activating scheduling stay in the existing operator workflow, including sources shared across companies.

Apply visibility before pagination, counts and matching capacity checks, not after selecting the top five. Use a consistent moderation revision in catalog and feature snapshots, cursors and preview receipts. Each moderation transaction advances that revision; readers validate it before returning results, rejecting stale pages if a removal races a ranking scan. Paid access must also obey visibility. Admin queries use an explicit authorized include-hidden path; public callers cannot enable it with a query parameter.

Already delivered browser content cannot be recalled. On the next request or focus refresh, discard stale hidden results and refresh counts. Avoid caching personalized or admin responses; invalidate any future public catalog caches when visibility changes. [Catalog implementation](../backend/src/application/catalog.ts), [matching scan](../backend/src/application/resume/match-jobs.ts), [publication races](JOB_FEATURES.md).

### Manage pricing tiers

The Pricing tiers view supports draft creation, editing, publishing and retirement. Fields include stable plan key, display name, description, currency, monthly amount, tax presentation and capabilities selected from the implemented allowlist. Initial Free stays five matches and initial Pro unlocks all eligible matches; changing the Free promise requires an explicit product-policy revision. A tier editor cannot grant unsupported features, admin privileges, broader source access or unbounded compute.

Keep plan revisions immutable once published. Separate commercial amount changes from capability changes, and show which customers and pending Checkout attempts are affected before publication:

1. Save a draft locally, validate supported currency/minor units, positive paid amount, monthly recurrence, supported capabilities and environment. Show the complete customer-facing price and feature preview.
2. On an authorized Publish action, create/reuse the Stripe Product and create a new Stripe Price using a durable, idempotent change operation. Stripe amounts on existing Prices are not editable; a new amount needs a new Price. [Stripe product/price management](https://docs.stripe.com/products-prices/manage-prices).
3. Only publish the local revision after Stripe creation and verification succeed. A retry resumes the recorded operation instead of creating another Price. If Stripe succeeds but the local commit fails, reconciliation recovers the draft operation; an orphan Price must never become purchasable automatically.
4. New Checkout attempts use the new revision. Attempts already created honor their captured price/capabilities until their existing expiry; the preview identifies that window. Validate completion against the captured revision, not the latest one. UI pricing reads the published server catalog rather than hardcoded amounts.
5. Existing subscribers keep their purchased Price and capability revision by default. Retirement disables new sales and new switches into the tier but does not cancel subscriptions or discard historical entitlement mappings. Publishing a new price does not silently reprice existing users.

Migrating existing subscriptions is a separate future workflow requiring an affected-subscriber preview, approved effective date, customer communication and an explicit proration/payment policy. It is not part of the default Publish button. Stripe subscription price changes can affect invoices and proration, so they require deliberate handling. [Changing subscription prices](https://docs.stripe.com/billing/subscriptions/change-price).

For v1, keep subscriber cancellation/payment repair in the Customer Portal; restrict plan-switching there until its choices agree with the published local catalog. The admin dashboard manages tier definitions and sale availability; refunds, individual subscriber migrations and manual access grants remain operator workflows. Price changes require no deployment after this catalog-backed workflow is implemented.

## Data, contracts and architecture

Preserve the existing [layer boundaries](ARCHITECTURE.md): access and visibility policies in domain, subscription/account/moderation/pricing workflows in application, narrow identity/billing/persistence ports, OAuth identity adapters and Stripe SDKs in infrastructure, input/session/signature/permission validation in API, explicit wiring in bootstrap. Keep the existing backend and frontend packages; no new service or general event bus is required. Add moderation overlays beside the current file-backed company registry rather than editing deployment configuration from browser requests; preserve [storage](STORAGE.md) and [source](SOURCES.md) invariants.

Proposed persistent records:

| Record             | Purpose and minimal fields                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User               | Internal ID, verified-email reference, account state and timestamps; identity mappings separately enforce unique issuer/subject                         |
| Session            | User ID, hashed opaque token, idle/absolute expiry, revocation timestamp                                                                                |
| BillingCustomer    | Unique user ID and unique Stripe Customer ID, environment                                                                                               |
| SubscriptionAccess | Subscription/customer/user IDs, approved Price, normalized status, settled coverage end, cancellation/refund/dispute restrictions, last reconciled time |
| CheckoutAttempt    | User, selected plan, idempotency key, Checkout ID, expiry and reconciliation state                                                                      |
| BillingEventInbox  | Unique Stripe event ID, safe object references, processing lease/retry state, outcome timestamps                                                        |

Admin additions are `AdminGrant` (verified user, permission, revocation), `CompanyVisibility` / `PostingVisibility` (target, removed state, reason, optimistic revision), a shared moderation revision, `PlanRevision` (immutable capability definition, environment and Stripe mapping), `PricingChangeOperation` (draft, idempotency/Stripe references and publication outcome), and `AdminAuditEntry` (actor, target, safe before/after values and outcome). Checkout attempts and subscription access bind to a plan revision. Keep historical revisions needed by subscribers even after retirement.

No resume/profile/history table is introduced. Invoice/card/address data stays with Stripe except the minimum identifiers needed for reconciliation. Define account, session and event retention and deletion before launch; do not promise erasure of records Stripe must retain. Stripe stores no candidate input. Existing local-worker and private matching protections remain required.

Optional analytics introduces minimal consented activity/journey records and aggregates, separately documented in [ANALYTICS_PLAN](ANALYTICS_PLAN.md). This measures product usage rather than storing profiles; approve its privacy/retention boundary before enabling collection.

Proposed public contracts, subject to generated OpenAPI types during implementation:

- `GET /api/v1/auth/providers`, `POST /api/v1/auth/:provider/start`, `GET /api/v1/auth/:provider/callback`, `POST /api/v1/auth/logout`: implemented bounded OAuth flow and session lifecycle; only GitHub and LinkedIn are allowlisted.
- `GET /api/v1/account`: current user identity and capabilities, billing state, access-end date; `no-store`.
- `POST /api/v1/billing/checkout`, `POST /api/v1/billing/portal`: authenticated, CSRF-protected, server-owned Stripe session creation.
- `POST /api/v1/billing/webhook`: signature-verified durable event acceptance.
- `GET /api/v1/plans`: published public pricing/features; no unpublished Stripe IDs or admin drafts.
- `/api/v1/admin/companies` and `/api/v1/admin/jobs`: permission-checked search/list, detail and visibility updates with a reason and expected revision. Use explicit moderation actions rather than destructive record deletion.
- `/api/v1/admin/plans`: permission-checked draft/edit/publish/retire actions; publication has a durable operation ID and recoverable status.
- `GET /api/v1/admin/activity`: authorized, bounded audit-history reads; no public audit feed.
- `/api/v1/admin/analytics/*`: permission-checked aggregate audience, funnel, revenue and health reports governed by [ANALYTICS_PLAN](ANALYTICS_PLAN.md).
- Existing matching routes: enforce tier limits, add explicit access metadata and preview receipt, and return typed authentication/upgrade errors for protected operations.

Keep billing SDK records out of public responses and avoid altering ranking payloads unnecessarily. Regenerate contracts after schema changes. Read [JOB_FEATURES](JOB_FEATURES.md) before adding entitlement-related snapshot/cursor checks so concurrent public-feature changes still produce the existing stale-result response.

## Delivery sequence and acceptance gates

1. **Policy and contracts — started.** Price/currency and GitHub/LinkedIn sign-in are selected. The draft offer catalog and pure Free/paid settled-coverage capability policy are implemented and tested. Preview receipts, paid cursor binding, moderation/pricing revisions and commercial terms remain pending.
2. **Identity foundation — started.** Users/identity mappings, hashed sessions, one-time OAuth attempts, GitHub/LinkedIn adapters, native password registration/login, email verification/reset codes, durable credential admission and an encrypted SMTP outbox/worker are implemented. Live journeys require provider/SMTP configuration. Admin grants, MFA/step-up, operator provisioning, deletion/recreation and retention jobs remain pending. No paid capability is enabled.
3. **Free preview and paywall.** Server limits to five, restricted comparison receipts and typed locked state. UI handles zero/fewer/exactly/more than five results, errors and unchanged resume review. This is the first product-facing gate; arbitrary API limits/cursors must fail to bypass it.
4. **Stripe sandbox end-to-end.** Implement Customer/Checkout/Portal adapters, durable inbox, access projection and reconciliation. Verify payment, extra authentication, async pending/failure, duplicate clicks, webhook replay/reordering, renewal failure/recovery, cancellation, refunds and disputes with synthetic identities and Stripe test fixtures/test clocks.
5. **Integrated upgrade UX.** Keep the original resume tab alive through inline signup and separate Checkout, unlock after server verification, and test desktop/mobile/tab discard. Paid pagination and detail comparison must stop after logout, expiry or downgrade. All private state stays out of storage, URLs, telemetry and Stripe metadata.
6. **Admin dashboard.** Deliver Companies/Jobs moderation, Pricing tiers drafts/publication/retirement and Activity. Verify hidden content disappears from every public surface, remains hidden after import/backfill and restores correctly. Exercise concurrent removals/ranking, stale edits, unauthorized users, catalog-editor attempts to change prices, MFA expiry, revoked grants, duplicate price publication, external/local partial failure, old Checkout completion and grandfathered subscribers.
7. **Analytics.** Deliver authoritative account/billing counts first, then observed DAU/WAU/MAU, consented audience/funnel/retention and operational health as sequenced in [ANALYTICS_PLAN](ANALYTICS_PLAN.md). Verify privacy exclusions, metric definitions, consent coverage, aggregation/deletion and reporting permissions.
8. **Production readiness.** Dedicated PostgreSQL concurrency tests, required billing/analytics workers, secrets/HTTPS/proxy policy, alerts and reconciliation runbook, verified billing-contact workflow, sandbox/live separation, administrator recovery and operator refund/cancellation procedure. Run root `pnpm check`, API authorization tests and browser journeys before release.

Required security regressions include forged/tampered preview receipts, caller-selected `limit=50`, old paid cursors after downgrade, arbitrary-job comparison, another user's Portal/Checkout ID, spoofed Checkout success, invalid webhook signatures, duplicate/out-of-order events, downtime recovery, session fixation and redirect misuse. Verify absence of protected records in browser network responses, not just rendered cards. Preserve matching scores across Free/Pro for the same job/profile.

Production enablement requires the product's actual monthly price and currency, merchant country/markets, tax treatment, recurring-billing/cancellation/refund language and support contact. Decide whether Stripe Tax is needed for the intended markets; enabling tax calculation alone does not decide registration obligations. Validate these commercial requirements separately rather than inventing them here. [Stripe Tax setup](https://docs.stripe.com/tax/set-up).

## Open decisions and limits

- **Price and currency:** US$7.95 monthly approved; catalog amount is 795 USD minor units. Stripe Price publication, tax presentation and commercial terms remain pending; Checkout stays disabled.
- **Identity:** application-owned email/password and GitHub/LinkedIn sign-in selected. Generic SMTP and a separate email worker are implemented. Provider/SMTP configuration, live delivery/consent verification, retention/deletion and admin MFA remain pending; no separate managed-auth service is required.
- **Usage allowances:** retain existing technical admission bounds initially; any daily paid/free quota needs explicit product copy and a versioned policy.
- **Public catalog:** remains public. Charging for complete personalized ranking cannot make publicly available job advertisements inaccessible elsewhere.
- **Cross-device resume continuity:** intentionally deferred. Accounts persist billing access, not a resume; reloads/new devices require a new analysis.
- **Existing subscriber migrations:** grandfather prices and capabilities by default; any bulk migration and notice/proration policy is a separate decision.
- **Admin operations:** reversible removal and tier management are included; permanent purges, arbitrary source activation and dashboard role assignment remain outside v1.

Planning verification: inspected matching routes, signed cursors, admission controls, Prisma models, catalog/lifecycle and frontend memory lifetime. Official guidance was checked on 5 October 2026. Account implementation/verification is recorded in [ACCOUNTS](ACCOUNTS.md); live Stripe and billing/admin journeys remain pending.
