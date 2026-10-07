# Decision: account settings and Stripe sandbox checkout

**Status:** Implemented sandbox integration, 7 October 2026, Europe/Amsterdam. External Stripe checkout remains unverified until sandbox credentials are supplied. Production subscriptions, entitlements and administration remain proposed in [ACCOUNT_BILLING_PLAN](ACCOUNT_BILLING_PLAN.md).

## Decision and rationale

The user requested account details, password reset, verified email changes, public pricing and working Stripe test checkout, then chose to configure Stripe later. The account dialog shows the verified email, an eight-dot password mask and the Basic plan. Native users can reset their password or confirm a new address; SSO credentials remain provider-managed. Pricing is reachable from the header and the account's Plans & billing section. Basic maps to the existing free access policy.

The approved US$7.95 monthly Pro offer now has three sandbox billing options. Quarterly billing discounts three monthly payments by 10%, rounding the whole bill to the nearest cent; annual billing discounts twelve monthly payments by 25%. Effective monthly figures are explanatory and never used to create Stripe prices.

| Frequency | Whole recurring bill | Recurrence     | Discount |
| --------- | -------------------- | -------------- | -------- |
| Monthly   | US$7.95              | Every month    | 0%       |
| Quarterly | US$21.47             | Every 3 months | 10%      |
| Yearly    | US$71.55             | Every year     | 25%      |

## Invariants and implementation

- [Domain offers](../backend/src/domain/accounts/plans.ts) own integer-cent amounts and intervals. `/api/v1/plans` returns these offers plus the sandbox configuration status. Production `purchasable` and matching-policy flags remain false.
- [Account routes](../backend/src/api/account-routes.ts) require an active session, exact Origin and CSRF for checkout creation. The strict body accepts only a billing period and retry UUID. User identity, prices and return URLs are selected on the server. Reads are private, bounded, silent and `no-store`.
- [TestBilling](../backend/src/application/accounts/test-billing.ts) depends on a [billing port](../backend/src/ports/billing.ts). The [Stripe adapter](../backend/src/infrastructure/accounts/stripe-test-billing.ts) uses the official SDK with bounded timeouts and retries. It verifies active, test-mode USD recurring prices against the domain offer before creating a subscription Checkout Session. Live keys, live responses and unexpected hosted URLs are rejected. Idempotency separates users and periods and remains stable for retries of the same UI attempt.
- Checkout opens through a separately clicked link in a new tab. The original resume remains mounted and no resume, skill, file or password enters Stripe metadata. Checkout and subscription metadata contain only the account reference and billing period.
- The return page retrieves the Checkout Session through an authenticated backend read and verifies ownership, mode, configured price, quantity and paid/completed status. Editable URL parameters never grant access. Accounts remain Basic throughout this sandbox increment; the interface explains test mode and planned Pro features.
- This increment does not persist Stripe Customers, reconcile invoices, project entitlements, handle webhooks, provide a Customer Portal or cancel subscriptions on account deletion. Reopening the dialog, changing period or starting from another tab can create another sandbox subscription. Configure only a sandbox and manage its test subscriptions in Stripe. Durable duplicate-subscription controls and deletion cancellation are required before live billing.

## Configure later

1. Add `STRIPE_SECRET_KEY=sk_test_…` to ignored `backend/.env`. Never put the key in frontend variables, chat or source control.
2. Run `pnpm billing:setup:test` from the repository root. The [setup command](../backend/src/cli/setup-stripe-test.ts) creates/reuses the Jobbely test product and stable lookup-key prices, verifies their amounts and recurrences, and writes only `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_QUARTERLY` and `STRIPE_PRICE_YEARLY`, preserving other environment settings.
3. Restart the API. For the local containers use `docker compose up -d --force-recreate --wait api`. The configured `FRONTEND_ORIGIN` must match the browser origin; Compose overrides it from `JOBBELY_ORIGIN`.
4. Sign in, choose a billing frequency and click Try Pro in test mode, then Continue to Stripe test checkout. Complete the sandbox flow and verify its result on return. Before enabling live billing, implement the remaining production gates above and in the billing plan.

Without the secret and all three price IDs, pricing remains readable and checkout is disabled. No public client key or webhook secret is needed for this hosted sandbox flow. [Stripe Checkout creation](https://docs.stripe.com/api/checkout/sessions/create), [recurring Price creation](https://docs.stripe.com/api/prices/create) and [session retrieval](https://docs.stripe.com/api/checkout/sessions/retrieve) describe the external API contracts.

## Verification

[Stripe adapter tests](../backend/src/infrastructure/accounts/stripe-test-billing.test.ts) exercise the actual SDK against a synthetic HTTP transport, checking recurring prices, retry keys, metadata, ownership, paid status and rejection of live/mismatched responses. [API tests](../backend/src/api/accounts.test.ts) check Origin, session, CSRF, strict client input and unavailable configuration. [PostgreSQL tests](../backend/src/infrastructure/storage/password-accounts-postgres.test.ts) exercise native account changes on an isolated database. These checks do not establish external Stripe connectivity or payment completion without configured credentials.

On 7 October 2026, root `pnpm check` passed 812 backend and 35 frontend tests with `TEST_DATABASE_URL` pointing to the isolated `jobbely_test_accounts` database, plus formatting, boundaries, zero-warning lint, types, generated contracts and both builds. Browser checks verified monthly/quarterly/yearly totals, sandbox-link preparation, account details/reset/change entry screens, eight-dot placeholders and local Galdeano loading. The 390px mobile account and pricing surfaces had no horizontal overflow. The local containers applied the email-change migration and served the unavailable-checkout state without Stripe configuration. A synthetic UI fixture was used for account interactions; the user's account was not changed.
