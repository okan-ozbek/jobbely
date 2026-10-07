# Decision: application-owned accounts and sessions

**Status:** First account foundation implemented, 5 October 2026, Europe/Amsterdam; self-service deletion added 7 October 2026. Live provider configuration and remaining billing/admin phases are pending.

## Decision and rationale

The user selected application-owned accounts instead of a separate managed-auth supplier. GitHub and LinkedIn verify external identity; [EMAIL_ACCOUNTS](EMAIL_ACCOUNTS.md) adds email/password registration, optional display username, confirmation codes, password recovery and a separate SMTP queue worker. Jobbely owns accounts and sessions; providers receive no resume access. The approved Pro offer is US$7.95 monthly, stored as 795 USD minor units. See [the delivery plan](ACCOUNT_BILLING_PLAN.md).

## Invariants and implemented behavior

- Map issuer/subject to local users. Different subjects/providers/native credentials never merge solely by email. GitHub uses numeric user ID; LinkedIn uses the verified OIDC subject. Only verified provider email is retained; optional missing email remains null. Native registration permits an optional display username. No provider name/avatar, resume, history or provider tokens are stored.
- Random OAuth state is stored hashed. Attempts are browser-cookie/provider-bound, expire in ten minutes and are atomically consumed once before exchange. GitHub uses S256 PKCE. LinkedIn verifies RS256 signature, issuer, audience, issued-at/expiry, nonce and userinfo subject. Fixed HTTPS requests use ten-second timeouts, bounded JSON and redirect rejection. Temporary verifiers/nonces disappear on consumption or expired-attempt cleanup during the next start request.
- Random session tokens use HttpOnly, SameSite=Lax, host-only cookies. HTTPS uses Secure and `__Host-`; HTTP is for loopback development only. PostgreSQL stores session hashes, separate CSRF tokens and revocation/idle/absolute expiry. Refresh cannot revive expired/revoked sessions, bypass disabled accounts or extend seven-day idle lifetime beyond thirty days absolute.
- Absent sessions are Guest; malformed/unknown/expired supplied sessions are 401. Database failure is a generic retryable 503. Mutations require exact configured Origin; logout also requires session CSRF. Auth responses are `no-store`; callback pages have `no-referrer` and restrictive CSP. Silent auth-route logging excludes callback codes/state and private exceptions. Per-process limits are sixty account requests and ten sign-in starts per minute per connection IP; distributed enforcement remains pending.
- The dialog handles native registration/login/code confirmation/reset in place. SSO starts authorization, then uses an explicitly clicked link in another tab. The original resume tab refetches its account on focus. Logout or observed identity loss/change clears the profile/comparison and remounts the workbench to release document state. No private browser storage is introduced. Other idle tabs clear on their next focus/refetch; already delivered content cannot be recalled.
- The Free/Pro offer catalog returns the approved draft price, capabilities, `purchasable: false` and `matchingPolicy.enabled: false`. Current matching remains unchanged until preview enforcement and an upgrade journey can launch together. No payment is collected.

The pure entitlement policy admits only known published/historical retired paid revisions with settled, unexpired coverage, active/past-due status, matching owner/environment and no full-refund/dispute restriction. Status alone, future periods, success URLs, trials, invalid coverage and unapproved revisions never grant access. Retired subscribers keep purchased capabilities. This policy is tested but not connected to a Stripe projection; every current session is Free.

## Permanent account deletion, 7 October 2026

Signed-in users can delete their account through the dialog after typing `DELETE`. `POST /api/v1/account/delete` requires a sign-in within ten minutes, active session, exact Origin, session CSRF and strict `{ "confirm": true }` input. Clients cannot select a user ID; session refresh does not satisfy reauthentication. The repository rechecks ownership, creation time, CSRF, revocation, account state and expiry inside the deletion transaction. Credential/identity locks follow sign-in ordering, preventing stale native logins from issuing surviving sessions for a deleted user.

Deletion removes the user, all sessions, native credential and linked SSO identities. Native accounts also remove email challenges and their associated outbox jobs under the email lock. An SSO email never establishes ownership of a separate native account or its mail. Short-lived HMAC rate windows remain to prevent deletion/re-registration bypassing admission. Unbound OAuth attempts and already detached expired outbox metadata follow existing bounded cleanup; an SMTP attempt already in flight cannot be recalled. Public jobs remain available. Subsequent registration or SSO sign-in creates a new account. The current tab clears resume state through the existing session-end callback; other tabs clear on focus/refetch.

Deletion covers implemented identity-only records. Future billing and analytics must extend this lifecycle before launch. Tests cover confirmation/Origin/CSRF guards, recent sign-in, atomic removal, cross-account isolation, native login races and fresh registration.

Verification on 7 October: root `pnpm check` passed formatting, dependency boundaries, logos, zero-warning lint, strict types, contracts, both builds and all 801 tests (766 backend, 35 frontend), including the PostgreSQL suites against `jobbely_test_accounts`. Browser checks used a separate localhost UI/API and synthetic account: native login, exact `DELETE` enablement, cancellation and 390×844 dialog fit passed. An actual HTTP deletion removed the synthetic user, credential and every session. Docker API/web/email images were rebuilt and the local services reported healthy. The existing application account was preserved.

## Setup and operation

Apply `pnpm db:migrate` with the existing PostgreSQL configuration before enabling providers. The additive [migration](../backend/prisma/migrations/202610050001_accounts/migration.sql) adds account/identity/session/attempt tables without altering jobs or source records. Memory accounts are test-only; persistent mode never falls back to them. Demo mode advertises sign-in unavailable.

Set backend-only `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` and/or `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`; both values are required per provider. Register exact callback URLs under `FRONTEND_ORIGIN`:

```text
/api/v1/auth/github/callback
/api/v1/auth/linkedin/callback
```

Locally those full URLs start `http://127.0.0.1:5173`; Vite proxies them to the API. Production needs the same-origin HTTPS reverse proxy. LinkedIn needs its Sign In with LinkedIn using OpenID Connect product and `openid profile email`. GitHub needs only `read:user user:email`; disable wildcard callbacks. Never expose secrets in frontend environment variables. No provider app registration or existing `.env` modification is performed by this increment.

Contracts include provider discovery, POST start, GET callback, GET account, POST logout and GET plans. The callback tells the user to return to the original tab; it contains no profile and grants no paid access.

## Implementation and verification

[Access policy](../backend/src/domain/accounts/access.ts), [session policy](../backend/src/domain/accounts/identity.ts), [workflows](../backend/src/application/accounts/accounts.ts), [ports](../backend/src/ports/accounts.ts), [OAuth adapters](../backend/src/infrastructure/accounts/oauth.ts), [PostgreSQL](../backend/src/infrastructure/storage/accounts-postgres.ts), [routes](../backend/src/api/account-routes.ts), [dialog](../frontend/src/features/accounts/AccountMenu.tsx).

Synthetic tests cover settled coverage, historical plans, owner/environment mismatches, restrictions, browser/provider/state binding, replay, minimal scopes, JWT nonce/audience/expiry/signature/subject failures, optional email, no email merging, hashing, cookies, CSRF/origin/schema guards, admission, revocation and expiry. Dedicated PostgreSQL tests exercise concurrent first registration, one-time attempt consumption, refresh/logout races, disabled users and absolute expiry across independent clients. Default tests skip database checks without an isolated `TEST_DATABASE_URL`; use `jobbely_test_*` per [QUALITY](QUALITY.md).

Live consent/callback journeys require app credentials and remain unverified. Native delivery requires SMTP configuration and the running email worker; native credential admission is durable across instances, while distributed OAuth admission remains pending. Production retention/session cleanup, account export/linking, admin grants/MFA and provisioning are pending. No Stripe customer/Checkout/Portal/webhook, paid projection, preview receipt, paywall, moderation, admin dashboard or analytics collection is enabled. Do not deploy this as completed production billing.

On 5 October 2026, root `pnpm check` passed formatting, boundaries, logos, zero-warning lint, strict types, generated contracts and both builds. All 588 backend and 35 frontend tests passed, including 14 PostgreSQL tests against the isolated `jobbely_test_accounts` database. The local additive migration also applied successfully. Manual browser checks confirmed provider-unavailable state, dialog dismissal/focus return and responsive fit at an observed 390px viewport. Live SSO remains a separate verification gate.

References checked 5 October: [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [GitHub email](https://docs.github.com/en/rest/users/emails), [LinkedIn OIDC](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2), [Stripe subscription states](https://docs.stripe.com/billing/subscriptions/overview), [currency minor units](https://docs.stripe.com/currencies).
