# Decision: native registration and a separate SMTP queue worker

**Status:** Implemented, 5 October 2026, Europe/Amsterdam. Synthetic verification is documented below; delivery through a configured external SMTP service remains a deployment gate.

## Decision and rationale

The user selected application-owned email/password registration alongside GitHub/LinkedIn SSO, confirmation by email code, generic SMTP and a separately runnable queue worker. Email is the login identifier. Username collection and display were removed on 7 October 2026; legacy database fields remain for compatibility. SSO and native accounts never merge solely because their emails match; account linking remains deferred. See [ACCOUNTS](ACCOUNTS.md) and [ACCOUNT_BILLING_PLAN](ACCOUNT_BILLING_PLAN.md).

Use a purpose-specific PostgreSQL outbox beside the existing account tables. Challenge creation and encrypted mail insertion commit in one transaction. This avoids accepting a registration request without durable delivery work, and keeps SMTP latency/failure outside API requests. The email worker is independent of the optional pg-boss ingestion scheduler; neither process starts the other. No general event bus or additional service is required.

## Identity and privacy invariants

On 8 October 2026, duplicate registration gained a specific `account_exists` response after a valid, unexpired, browser-bound code. The transaction consumes the challenge and clears pending secrets, but never overwrites the existing credential or issues a session. Invalid codes still receive `invalid_code`; registration requests retain the same generic receipt. The client returns to sign-in with the verified email retained and password recovery available. A failed/expired code also offers restarting registration. Existing passwords and sessions remain intact.

- Registration creates a pending challenge, not a usable account. A correct, unexpired, browser-bound code creates the verified credential and a fresh application session atomically. Existing native credentials cannot be overwritten through registration. Native sessions follow the existing disabled-account, idle/absolute-expiry and cookie rules.
- Passwords are normalized to NFC, require 8–128 Unicode code points including an ASCII number and a punctuation or symbol character, and are stored only as independently salted scrypt hashes (`N=131072`, `r=8`, `p=1`, 64-byte output). Missing credentials perform the same derivation before returning a generic login error. At most two derivations run concurrently per process; excess work fails with a retryable unavailable response.
- Codes are six decimal digits, including leading zeros, valid for ten minutes, and bound to purpose, challenge and HttpOnly browser cookie. PostgreSQL stores an HMAC of the code with a backend secret; opaque challenge/session tokens are stored hashed. Five wrong attempts exhaust a challenge. Successful confirmation/reset consumes it once across independent API clients.
- A new request invalidates older challenges for the same email and purpose. Resends invalidate the previous code, allow three emails including the original, and do not extend expiry or reset attempts. A randomly regenerated code can coincidentally have the same six digits; its probability does not bypass the attempt limit.
- Durable fifteen-minute admission windows limit login to 20 requests per IP and 10 per email; register/reset to 10 per IP and 3 per email per purpose, including resends; verification/resend to 30 per IP. Keys are domain-separated HMACs, not plaintext identities. The existing per-process account-route limiter also applies. Trusted proxy configuration remains an operational requirement before using connection IP behind a proxy.
- Password-reset requests use the same generic response for unknown emails, which do not enqueue mail. Correct proof updates the hash and revokes every existing session; password login rechecks the hash under the email lock so a pre-reset verification cannot issue a post-reset session. Reset does not automatically sign in.
- Auth mutations require the exact configured Origin. Routes are silent, bounded, strict-schema and `no-store`; responses never include passwords, hashes or mail codes. The frontend keeps passwords/challenges/codes in component memory, clears secrets on mode change and unmount, and preserves the mounted resume tab. No candidate input, filenames or match evidence enters account or mail records.

## Queue delivery and retention

### Verified email changes (7 October 2026)

Native users can request a new email from account settings using their current password, session, exact Origin and CSRF token. `/api/v1/account/email/change` sends an encrypted-outbox code to the new address; `/confirm` and `/resend` require the same authenticated owner and browser binding. `change-email` has its own purpose-bound HMAC and HTML/plaintext copy, also previewable at `/api/v1/email-preview/change-email`. Five attempts, three sends, a ten-minute lifetime and durable IP/address/owner admission limits apply.

The [email-change migration](../backend/prisma/migrations/202610070001_email_change/migration.sql) adds owner and previous-email fields and extends purpose/shape constraints. The [repository](../backend/src/infrastructure/storage/password-accounts-postgres.ts) locks old/new email addresses in sorted order and rechecks the active session, owner and password hash in the transaction. Confirmation updates the same credential/user, consumes pending codes, revokes all old sessions and issues a fresh HttpOnly session atomically. Changed passwords, revoked/expired sessions, wrong owners/browsers and occupied native addresses cannot complete the change. SSO accounts never merge by address. Deletion also removes owner-bound pending change emails. The public account response exposes `hasPassword`, never a hash or password.

The settings/password placeholder UI and sandbox pricing are documented in [BILLING_TEST](BILLING_TEST.md). Password reset remains the existing recovery-code workflow and signs out current sessions after completion.

On 7 October 2026, confirmation and recovery emails gained a shared HTML template with the application's lavender palette, rounded card and prominent six-digit code. Both retain a plain-text alternative, use no remote assets and escape dynamic HTML. Resends explain expiry relative to the first request. [Template](../backend/src/infrastructure/accounts/account-email-template.ts), [SMTP transport](../backend/src/infrastructure/accounts/smtp.ts).

The dialog now collects only email/password, shows `example@jobbely.com` in email fields and names the recipient in the registration receipt. Six individually labelled digit fields advance automatically, support keyboard correction and distribute pasted full codes from any field. New passwords are checked in the client and server; existing credentials remain usable for login regardless of the new creation policy. [Code input](../frontend/src/features/accounts/VerificationCodeInput.tsx), [password policy](../backend/src/domain/accounts/password.ts).

Mail payloads contain only recipient, purpose, code and expiry, encrypted/authenticated with AES-256-GCM and a domain-separated key derived from `AUTH_CODE_SECRET`. API and worker must share the same secret. Never place it in frontend configuration or logs. Changing the secret invalidates outstanding codes and queued ciphertext; restart both processes and request new codes rather than expecting old messages to remain usable.

The worker polls once per second when idle. `FOR UPDATE SKIP LOCKED` assigns a sixty-second lease, allowing multiple workers against the same database. Expired leases can be reclaimed. Delivery has a thirty-second deadline, at most three attempts, and delays of twenty and forty seconds before retries. TLS is required by default; explicit plaintext mode is permitted only for a literal loopback SMTP capture service. Worker logs contain generic outcomes, without recipients, codes or SMTP exceptions.

Delivery is at least once: a crash after SMTP acceptance but before marking the job sent can resend the same code. Success/final failure/cancellation clears the encrypted payload. The worker cancels expired payloads, deletes expired challenges and removes job metadata twenty-four hours after challenge expiry. New challenge creation also removes expired pending secrets. Rate windows are pruned on admission. Self-service deletion removes native challenges and their associated outbox records under [ACCOUNTS](ACCOUNTS.md). Broader account/session retention and scheduled cleanup remain pending.

SMTP delivery does not prove arrival in an inbox. Monitor queue state and expired/failed deliveries, configure the sender domain with the mail provider, and check delivery/bounce reporting before production launch. A worker must be supervised and running for email to be delivered. A third-attempt worker crash leaves its exhausted lease until expiry cleanup; it never results in unlimited sends.

## Setup and operation

The unprotected `GET /api/v1/email-preview/register` and `GET /api/v1/email-preview/reset` endpoints render the same HTML templates as SMTP delivery, using the fixed sample code `012345`. Open [confirmation](http://localhost:8080/api/v1/email-preview/register) or [password recovery](http://localhost:8080/api/v1/email-preview/reset) on the local web origin. These read-only previews require no SMTP credentials, send no email, read no account records and accept no recipient/code/challenge query parameters. Responses use `no-store`, restrictive HTML CSP and `noindex` headers. This temporary public preview access was explicitly requested on 7 October 2026; moving it behind admin authorization is deferred, not implemented. [Routes](../backend/src/api/email-preview-routes.ts).

The preview increment passed root `pnpm check` on 7 October: all 821 tests (786 backend, 35 frontend), including PostgreSQL, plus formatting, boundaries, logos, lint, types, contracts and builds. The local API image was rebuilt, and both preview URLs rendered the expected HTML in the browser through the running web proxy.

Apply the additive [native-account migration](../backend/prisma/migrations/202610050002_password_accounts/migration.sql):

```sh
pnpm db:migrate
```

Set backend-only values using [backend/.env.example](../backend/.env.example):

| Setting                              | Requirement                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `DATA_MODE=postgres`, `DATABASE_URL` | API and worker use the same persistent application database                     |
| `FRONTEND_ORIGIN`                    | Exact browser origin; HTTPS except literal loopback development                 |
| `AUTH_CODE_SECRET`                   | At least 32 characters; generate a random secret, share between API and worker  |
| `SMTP_HOST`, `SMTP_FROM`             | Required by the email worker; sender is a verified address at the SMTP provider |
| `SMTP_PORT`                          | Defaults to 587                                                                 |
| `SMTP_SECURE`                        | `false` for required STARTTLS; `true` for implicit TLS, usually port 465        |
| `SMTP_USER`, `SMTP_PASSWORD`         | Supply both if authentication is required                                       |
| `SMTP_ALLOW_INSECURE_LOCAL`          | Defaults to `false`; enable only for a loopback mail capture service            |

The API advertises email sign-in only when PostgreSQL and `AUTH_CODE_SECRET` are configured. It does not require SMTP settings because delivery belongs to the worker. Restart the API after adding configuration. Existing local environment settings are preserved by this implementation.

Run the separate development process from the repository root:

```sh
pnpm worker:email
```

After `pnpm build`, production runs from `backend/`:

```sh
node dist/worker/account-email.js
```

Run independently of ingestion and keep it supervised. Shutdown drains the current bounded SMTP attempt and closes the transport/database. Multiple instances use the same database and secret. A safe aggregate queue check is:

```sql
SELECT state, count(*) FROM "AccountEmailJob" GROUP BY state;
```

## Implementation and verification

On 7 October 2026, the account interface/email update passed root `pnpm check`: formatting, boundaries, logos, zero-warning lint, types, generated contracts, both builds and all 815 tests (780 backend, 35 frontend), including PostgreSQL against `jobbely_test_accounts`. SMTP capture verified multipart HTML/plain-text delivery. Browser checks with synthetic account responses verified password errors, digit focus/paste, deletion confirmation and return home from Companies; dialog and email previews fit a measured 390×844 viewport. The deployed registration dialog was also checked at `http://localhost:8080`; API, web and email-worker images were rebuilt successfully. No new external test email was sent, so actual inbox rendering of the new template remains to be checked.

[Domain](../backend/src/domain/accounts/password.ts), [workflow](../backend/src/application/accounts/password-accounts.ts), [port](../backend/src/ports/password-accounts.ts), [transactional PostgreSQL repository](../backend/src/infrastructure/storage/password-accounts-postgres.ts), [scrypt](../backend/src/infrastructure/accounts/password-hasher.ts), [cipher](../backend/src/infrastructure/accounts/email-cipher.ts), [queue](../backend/src/infrastructure/accounts/account-email-queue.ts), [SMTP](../backend/src/infrastructure/accounts/smtp.ts), [worker](../backend/src/worker/account-email.ts), [routes](../backend/src/api/account-routes.ts), [frontend form](../frontend/src/features/accounts/EmailAccountForm.tsx).

Synthetic tests exercise real scrypt, authenticated queue encryption/tampering, actual SMTP delivery to a local capture server and required-TLS rejection. Isolated PostgreSQL tests cover leading-zero codes, proof before registration, browser/purpose binding, expiry, concurrent confirmation and wrong attempts, resend invalidation, unknown reset addresses, reset/session revocation, stale-password login, disabled accounts, cross-client admission, worker leases/retries and guarded API cookies/responses. Database tests require `TEST_DATABASE_URL` pointing to an isolated `jobbely_test_*` database; skipped tests are not evidence of correctness. See [QUALITY](QUALITY.md).

Live external SMTP delivery and live SSO consent remain unverified without configuration. This increment does not enable Stripe, a paywall, admin access or analytics. Follow the remaining gates in [ACCOUNT_BILLING_PLAN](ACCOUNT_BILLING_PLAN.md).

On 5 October 2026, root `pnpm check` passed formatting, boundaries, logos, zero-warning lint, strict types, regenerated contracts and both production builds. All 603 backend and 35 frontend tests passed, including 25 PostgreSQL tests in the isolated `jobbely_test_accounts` database. The additive local migration applied successfully. Browser checks used synthetic identity/input, a separate test API/database, a loopback SMTP capture and the actual email-worker entry point: registration/code confirmation preserved the resume tab, returning login succeeded, logout cleared private state, reset returned to login, and the new password signed in successfully. Registration fit a measured 390×844 viewport without horizontal dialog overflow. After the final label-layout adjustment, root `pnpm lint`, `pnpm format:check` and `pnpm typecheck` passed again. External delivery remains a separate gate.

References checked 5 October 2026: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP password recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Nodemailer SMTP](https://nodemailer.com/smtp).

New-password forms now show the three requirements and confirmation match as the user types, with accessible invalid state and inline feedback. [Client validation](../frontend/src/features/accounts/password-validation.ts) mirrors the existing normalized 8–128 code-point, ASCII number and Unicode punctuation/symbol policy; server admission remains authoritative. Login accepts existing credentials without imposing the new-password checks.
