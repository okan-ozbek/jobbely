# Plan: accounts, tiers and Stripe subscriptions

**Status:** Proposed, 5 October 2026, Europe/Amsterdam. No authentication, paywall or payment code is implemented by this plan.

**Confirmed product choices:** Visitors can analyze a resume and see their top five matches without an account. An account is required to upgrade. The first paid tier is a monthly subscription.

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

Use managed identity rather than implementing password storage and recovery. The recommended first flow is email plus a one-time verification code entered inside the existing app. It serves registration and returning-user login, verifies the email before Checkout and avoids a full-page login redirect that would erase the resume in React memory. Google login can follow later; it is not required for launch.

Supabase Auth is a candidate for the managed email-code adapter; Clerk is another candidate if its account/session UX better fits deployment. Select one after checking cost, region, email delivery, deletion/export and code-verification support. This plan does not authorize buying a service or migrating the current PostgreSQL database. [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless) documents code-based login; [Clerk session verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification) documents server verification.

Proposed flow and controls:

1. Upgrade opens an inline account dialog. Enter email, request a code, then verify it. Existing users follow the same flow. Use generic responses to avoid account enumeration; bound attempts, resend frequency and expiry through the provider and backend.
2. The backend verifies the provider result and maps its stable issuer/subject to a local user. Never identify an account solely by submitted email or automatically merge identities with the same address.
3. Issue an opaque application session in a Secure, HttpOnly, SameSite=Lax cookie. Store only a hash of the session secret in PostgreSQL. Proposed limits: seven days idle, thirty days absolute, renewed only within that absolute limit. Provider credentials stay in infrastructure; no authentication token is placed in a resume URL.
4. Authenticated mutations require the session, exact allowed origin and CSRF protection. Backend billing/authorization decisions never trust a frontend user ID, plan, customer ID or role. Session and billing reads return `no-store`.
5. Logout revokes the application session and clears private workbench state and paid result cards. Account deletion revokes all sessions and handles the subscription before removing login access. Reauthentication is required for deletion or other sensitive account changes.

Keep provider SDK/network calls in a backend adapter where supported, minimizing third-party scripts on the resume page. Authentication receives identity fields only, not resume text, filenames or match evidence. Use [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) during implementation.

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

Use Stripe Billing with a single Pro product, one allowlisted monthly recurring Price and Stripe-hosted Checkout. Use the Customer Portal for card updates, invoices and cancellation. This avoids building payment forms. Stripe supports server-created Checkout Sessions and hosted subscription management. [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions), [Customer Portal](https://docs.stripe.com/customer-management).

1. Authenticated `POST /api/v1/billing/checkout` resolves the user and creates/reuses their unique Stripe Customer. Only the server chooses the configured Price, currency, quantity and return URLs. Send the internal user reference and billing identity; never send a resume or skill metadata. Reject client-supplied prices, arbitrary return URLs and other users' customer IDs.
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

No free trial, coupons, annual plan or proration is proposed for v1. Do not infer paid coverage solely from the subscription's upcoming billing period or `active` status: Stripe explains that an active subscription does not prove every invoice has been paid. Normalize settled coverage and renewal state from the pinned API version. Zero-value promotional invoices, manual collection and arbitrary subscription products do not automatically grant Pro. [Subscription statuses](https://docs.stripe.com/billing/subscriptions/overview).

Expose Manage subscription and the access-end date. Configure period-end cancellation in the Portal and a payment-repair action for failures. Refunds and subscription cancellation are separate operations; support tooling must explicitly reconcile both. Closing an account must not leave a renewing subscription with no owner able to cancel it.

## Webhooks and reconciliation

Create a dedicated Fastify webhook route that preserves raw request bytes for signature verification. It is authenticated by Stripe's signature, not by a browser session/CSRF token. Reject invalid signatures and unexpected live/test environment identifiers. Pin the Stripe SDK/API and event endpoint versions at implementation time. [Stripe webhook guidance](https://docs.stripe.com/webhooks).

Subscribe initially to `checkout.session.completed`, `checkout.session.expired`, relevant asynchronous Checkout payment outcomes, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.finalization_failed`, and refund/dispute events. Finalize the exact set for enabled payment methods; do not subscribe to unrelated events without a handler. [Subscription webhook lifecycle](https://docs.stripe.com/billing/subscriptions/webhooks).

After signature validation, durably insert an inbox record containing unique event ID, type, mode and allowlisted object references, then acknowledge. Do not acknowledge before durable storage or retain entire event bodies by default. A dedicated billing worker processes/retries the inbox; reuse the existing PostgreSQL queue approach, but do not depend on the optional ingestion scheduler being enabled. Return a non-success response if durable acceptance fails so Stripe retries.

Stripe can redeliver events and does not guarantee their order. Serialize reconciliation per customer/subscription, fetch current Stripe state, then atomically update the local projection and processed inbox marker. Repeated logical updates must be idempotent even if they arrive with different event IDs. Never use event timestamps alone as an ordering guarantee. Expired leases and bounded retry/backoff need database tests; permanent failures enter an operator-visible queue.

Reconcile active/pending/past-due subscriptions periodically and on the authenticated Checkout return path. Both paths use the same serialized update logic as webhooks. If Stripe is unavailable, already verified paid coverage remains valid until its recorded end; do not grant or extend unknown coverage. Monitor inbox age, reconciliation failures, customer/subscription mismatch, duplicate-purchase attempts and payment-to-unlock delay without recording candidate input. No payment-provider request should occur for every ranked job.

## Data, contracts and architecture

Preserve the existing [layer boundaries](ARCHITECTURE.md): access policy in domain, subscription/account workflows in application, narrow identity/billing/persistence ports, managed auth and Stripe SDKs in infrastructure, input/session/signature validation in API, explicit wiring in bootstrap. Keep the existing backend and frontend packages; no new service or general event bus is required.

Proposed persistent records:

| Record             | Purpose and minimal fields                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User               | Internal ID, unique provider issuer/subject, verified-email reference, account state and timestamps                                                     |
| Session            | User ID, hashed opaque token, idle/absolute expiry, revocation timestamp                                                                                |
| BillingCustomer    | Unique user ID and unique Stripe Customer ID, environment                                                                                               |
| SubscriptionAccess | Subscription/customer/user IDs, approved Price, normalized status, settled coverage end, cancellation/refund/dispute restrictions, last reconciled time |
| CheckoutAttempt    | User, selected plan, idempotency key, Checkout ID, expiry and reconciliation state                                                                      |
| BillingEventInbox  | Unique Stripe event ID, safe object references, processing lease/retry state, outcome timestamps                                                        |

No resume/profile/history table is introduced. Invoice/card/address data stays with Stripe except the minimum identifiers needed for reconciliation. Define account, session and event retention and deletion before launch; do not promise erasure of records Stripe must retain. Stripe stores no candidate input. Existing local-worker and private matching protections remain required.

Proposed public contracts, subject to generated OpenAPI types during implementation:

- `POST /api/v1/auth/email/start`, `POST /api/v1/auth/email/verify`, `POST /api/v1/auth/logout`: bounded managed-code flow and application session lifecycle.
- `GET /api/v1/account`: current user identity and capabilities, billing state, access-end date; `no-store`.
- `POST /api/v1/billing/checkout`, `POST /api/v1/billing/portal`: authenticated, CSRF-protected, server-owned Stripe session creation.
- `POST /api/v1/billing/webhook`: signature-verified durable event acceptance.
- Existing matching routes: enforce tier limits, add explicit access metadata and preview receipt, and return typed authentication/upgrade errors for protected operations.

Keep billing SDK records out of public responses and avoid altering ranking payloads unnecessarily. Regenerate contracts after schema changes. Read [JOB_FEATURES](JOB_FEATURES.md) before adding entitlement-related snapshot/cursor checks so concurrent public-feature changes still produce the existing stale-result response.

## Delivery sequence and acceptance gates

1. **Policy and contracts.** Decide price/currency, auth supplier and commercial terms. Define the access matrix, preview receipt, capability projection and lifecycle fixtures before UI or Stripe wiring. Confirm the free reranking boundary and test every protected endpoint.
2. **Identity foundation.** Add users/sessions and the managed email-code adapter. Verify login, account recreation rules, signout, expired/revoked sessions, CSRF, account ownership and email delivery. No paid capability is enabled yet.
3. **Free preview and paywall.** Server limits to five, restricted comparison receipts and typed locked state. UI handles zero/fewer/exactly/more than five results, errors and unchanged resume review. This is the first product-facing gate; arbitrary API limits/cursors must fail to bypass it.
4. **Stripe sandbox end-to-end.** Implement Customer/Checkout/Portal adapters, durable inbox, access projection and reconciliation. Verify payment, extra authentication, async pending/failure, duplicate clicks, webhook replay/reordering, renewal failure/recovery, cancellation, refunds and disputes with synthetic identities and Stripe test fixtures/test clocks.
5. **Integrated upgrade UX.** Keep the original resume tab alive through inline signup and separate Checkout, unlock after server verification, and test desktop/mobile/tab discard. Paid pagination and detail comparison must stop after logout, expiry or downgrade. All private state stays out of storage, URLs, telemetry and Stripe metadata.
6. **Production readiness.** Dedicated PostgreSQL concurrency tests, required billing worker, secrets/HTTPS/proxy policy, alerts and reconciliation runbook, email configuration, sandbox/live separation and operator refund/cancellation procedure. Run root `pnpm check`, API authorization tests and browser journeys before release.

Required security regressions include forged/tampered preview receipts, caller-selected `limit=50`, old paid cursors after downgrade, arbitrary-job comparison, another user's Portal/Checkout ID, spoofed Checkout success, invalid webhook signatures, duplicate/out-of-order events, downtime recovery, session fixation and redirect misuse. Verify absence of protected records in browser network responses, not just rendered cards. Preserve matching scores across Free/Pro for the same job/profile.

Production enablement requires the product's actual monthly price and currency, merchant country/markets, tax treatment, recurring-billing/cancellation/refund language and support contact. Decide whether Stripe Tax is needed for the intended markets; enabling tax calculation alone does not decide registration obligations. Validate these commercial requirements separately rather than inventing them here. [Stripe Tax setup](https://docs.stripe.com/tax/set-up).

## Open decisions and limits

- **Price and currency:** intentionally unset. Show neither a guessed price nor a live Checkout until the Price configuration is approved.
- **Auth supplier:** managed email-code flow is recommended; vendor selection and retention configuration remain pending.
- **Usage allowances:** retain existing technical admission bounds initially; any daily paid/free quota needs explicit product copy and a versioned policy.
- **Public catalog:** remains public. Charging for complete personalized ranking cannot make publicly available job advertisements inaccessible elsewhere.
- **Cross-device resume continuity:** intentionally deferred. Accounts persist billing access, not a resume; reloads/new devices require a new analysis.

Planning verification: inspected current matching routes, schemas, signed cursor logic, private-route admission controls, Prisma models and frontend memory lifetime. Official payment/authentication guidance was checked on 5 October 2026. Implementation, migrations, live Stripe setup and end-to-end billing tests remain pending.
