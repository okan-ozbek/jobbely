# Plan: admin analytics and product measurement

**Status:** Proposed, 5 October 2026, Europe/Amsterdam. No analytics collector, tracking identifiers, aggregation tables or analytics dashboard is implemented by this plan.

The admin dashboard in [ACCOUNT_BILLING_PLAN](ACCOUNT_BILLING_PLAN.md) will include audience, registration, activity, product-funnel and subscription analytics. “MUA” is interpreted as **MAU: monthly active users**. This document owns metric definitions, collection boundaries and verification; the accounts plan owns login, admin authorization and payment access. The [account foundation](ACCOUNTS.md) is implemented; analytics collection remains proposed.

## Dashboard views

| View           | Questions answered                      | First release                                                                                                                           |
| -------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Overview       | How many use the app, register and pay? | Current registered accounts, new registrations, observed DAU/WAU/MAU, paid-access accounts, MRR and data freshness                      |
| Audience       | Are people returning?                   | Observed visitors, sessions, new/returning visitors, account activity trends and signup-cohort retention                                |
| Product funnel | Where do users stop?                    | Resume review, matching, results displayed, paywall, registration, Checkout and paid activation                                         |
| Revenue        | Are subscriptions growing?              | Subscribers by tier/Price revision, new/lost subscribers, scheduled cancellations, MRR, collected payments, refunds and failed renewals |
| Health         | Is usage being blocked by failures?     | Analysis/matching failure rates, latency, empty results, billing activation delay and analytics delivery lag                            |

Default to the last thirty days with Today, 7 days, 30 days, 90 days and calendar-month selectors, previous-period comparison and daily charts. Label rolling MAU and calendar-month active users separately. Every card/chart shows definition, population, timezone, coverage, last update and whether today's data is partial. Display unavailable/stale metrics as unavailable/stale, not zero.

Use Europe/Amsterdam for displayed day boundaries and UTC for persisted timestamps. Calculate boundaries with a timezone-aware library, including daylight-saving changes. Distinct-user windows do not equal the sum of daily distinct counts. Keep operational service counters separate from product visitor counts.

## Metric dictionary

An **active account** is a verified registered account with at least one measured product-use action: viewing the company/job catalog or a job detail, successfully analyzing a resume, or completing matching. A login, subscription renewal, background entitlement poll, asset request or email verification alone is not activity. Count an account once per window across tabs/devices; distinguish attempts and completions in usage metrics.

| Metric                          | Definition and source                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current registered accounts     | Existing verified local User records, excluding deleted, test and operator accounts; disabled accounts shown as a separate count                                   |
| New registrations               | Accounts first verified in the selected interval; duplicate login/provider callbacks are not new registrations; distinguish later deletions from new signup volume |
| DAU                             | Distinct observed active registered accounts in one local calendar day; today's figure is partial                                                                  |
| WAU                             | Distinct observed active registered accounts across today and the preceding six local days                                                                         |
| MAU                             | Distinct observed active registered accounts across today and the preceding twenty-nine local days; not all accounts created in a month                            |
| Calendar-month active users     | Distinct observed active registered accounts in the selected calendar month; current month is partial                                                              |
| Stickiness                      | DAU / rolling MAU for the same population and day; no denominator means unavailable                                                                                |
| Active now                      | Observed distinct accounts and guest sessions with foreground activity in the last five minutes; approximate, not an exact live people count                       |
| Observed unique visitors        | Distinct consented browser visitor identifiers in the window; browser estimate, not verified people; separate from registered MAU                                  |
| Sessions                        | Consented foreground visits, ending after thirty minutes without product activity; SPA navigation stays in the same session                                        |
| New/returning visitors          | First seen / previously seen within retained consented visitor history; cookie reset, consent changes and another browser can classify someone as new              |
| Resume analyses / matching runs | Successful server operations, with attempt/failure counts alongside them; recalculations and pagination are separate operation types                               |
| Matching users                  | Distinct observed subjects completing at least one initial matching run; repeated retries/recalculations do not multiply users                                     |
| Paid-access accounts            | Distinct accounts currently entitled to a paid capability through the billing projection; not necessarily Stripe's active-subscriber count                         |
| Free/paid active accounts       | Observed active accounts split by the entitlement revision effective at their activity time, not their plan today                                                  |

Do not add guest visitors and registered MAU to produce “total people”: the same person can appear in both. Do not use IP addresses or IP/user-agent fingerprints as identity. Never label request counts as users. Bots, uptime probes, internal admin traffic, demo mode and test identities are excluded where identifiable; bot filtering is imperfect and its version must be recorded.

## Registration, conversion and retention

Registration totals come directly from account records and verified lifecycle events. Billing totals come from reconciled Stripe data. They do not depend on a browser accepting optional analytics. Audience/funnel activity uses the measured population described below; display that limitation next to conversion rates.

Proposed consented funnel:

1. Resume page viewed.
2. Initial analysis successfully completed.
3. Matching successfully completed and results displayed.
4. Paywall actually displayed because more than five results exist.
5. Upgrade selected and account verified, or an existing account signed in.
6. Server creates Checkout.
7. Server verifies first paid activation.

Use one consented journey identifier to connect the originating resume tab with Checkout; send it to Jobbely only, not as candidate metadata to Stripe. Keep the link only for the configured retention period. A foreground rendered event is required for “results displayed” and “paywall viewed”; a successful API response alone does not establish that either was seen. Display measured step counts and step-to-step conversion with the same deduplicated population. Returning subscribers and existing-account logins are separate branches rather than mislabeled new registrations.

For v1, use a seven-day conversion window from the first qualifying step and count each measured subject once per cohort/step, requiring steps in order. Report incomplete seven-day cohorts as provisional. Registration-to-paid conversion also has an exact account cohort: accounts registered in the period whose first settled paid activation occurs within seven days, divided by that registration cohort. Exclude still-immature cohorts from the finalized rate; payments after seven days appear in a later-conversion count.

Retention is defined for observed registered accounts activated by their first measured product-use action: D1, D7 and D30 show the proportion with another measured action on the corresponding local day. Only completed observation windows and subjects with the required measurement permission are eligible. Consent withdrawal makes subsequent activity unobservable, not proof the person stopped using the app; label this as observed retention. Add weekly/monthly cohorts later if the sample supports them. No predictive lifetime-value claim is proposed for launch.

## Subscription and revenue metrics

Reconcile billing analytics against the same Customer/Subscription/Price mappings used for access. Distinguish Stripe active subscribers, Jobbely paid-access accounts and actively using subscribers. Stripe's definitions can include past-due subscriptions while local access may already have expired. Configure and version the definitions used in reports. [Stripe Billing analytics](https://docs.stripe.com/billing/subscriptions/analytics).

- **MRR:** Monthly-normalized recurring value of supported paid subscriptions in Stripe `active` or `past_due` states, excluding tax/free/trial amounts and applying the configured discount policy. Scheduled cancellations remain included until they end. Use historical purchased Prices, not the current advertised price. Present each currency separately until an explicit FX policy exists.
- **Collected payments:** Settled subscription invoice receipts in the interval, with taxes and refunds shown separately. MRR is not collected cash, Stripe payout balance or accounting revenue. Separate transaction timing from the recurring-value snapshot.
- **New/lost subscribers:** Accounts first becoming paid / ceasing to be paying subscribers in the period; payment repair and reactivation are distinct. Scheduled cancellation is a future-risk indicator, not immediate churn.
- **Subscriber churn:** Opening paid-subscriber cohort members that cease paid subscription status during the period divided by that opening cohort. Exclude new subscribers that joined during the period from the denominator; report reactivations separately. Define status transitions consistently with the pinned Stripe report settings.
- **Failures and refunds:** Failed renewal invoices, authentication-required payments, refunded amount/count and disputes. Deduplicate webhook delivery and count distinct business objects rather than events.
- **Upgrade delay:** Time from a verified successful payment to locally available paid access, with p50/p95 and a sample count. This identifies webhook/reconciliation problems.

Stripe metrics are a reconciliation source, not a substitute for product usage analytics. The dashboard must show the billing sync time and differences awaiting reconciliation. No individual billing identities or bank/card fields are exposed through analytics responses.

## Collection, consent and privacy

Recommend first-party collection into Jobbely's existing backend/PostgreSQL with scheduled aggregates. Start without Google Analytics, session replay, heatmaps or an additional third-party SDK on the resume page. This keeps collection small and explicit; it does not make every identifier anonymous or automatically exempt from consent rules.

For the initial plan, optional longitudinal usage measurement is opt-in. Before opt-in, record only approved identity-free operational counts and account/billing totals needed for the service. Do not reuse login or preview-security cookies as analytics identity. With opt-in, use a separate random first-party visitor identifier, proposed thirty-day lifetime, and a server-derived pseudonymous account subject after verified login. Prefix guest/account namespaces; never hash an email as an anonymization claim. These identifiers are pseudonymous personal data, not anonymous statistics.

MAU and unique visitors initially mean **observed, consented usage**. They can undercount overall app use; display opt-in coverage among eligible measured sessions without extrapolating a headcount. If complete registered-account MAU is required without opt-in, a separate documented lawful-basis, transparency and minimization decision must authorize limited account-day activity before implementation. This plan does not assume an audience-measurement exemption applies to all markets. [CNIL audience measurement guidance](https://www.cnil.fr/fr/node/677).

Declining or withdrawing analytics does not change the five free results, pricing or paid access. Withdrawal stops subsequent optional events, clears the analytics cookie and schedules removal of linked granular records. Account deletion removes the associated activity/journey identifiers subject to the published retention policy; aggregated, non-identifying totals may remain. Do not stitch anonymous history retrospectively across devices or before consent. Link a guest journey to login only inside that consented journey to avoid double-counting funnel steps.

The following are forbidden in analytics: resume bytes/text, filenames, extracted skills, degrees, employers, employment dates, current location, match scores/evidence, profile fingerprints, free-text search/filter values, email addresses, auth tokens, preview receipts, full URLs/query strings, raw referrers, IP addresses and full user-agent strings. Existing [resume privacy](RESUME_PRIVACY.md) stays unchanged. A page event records only an allowlisted view such as `resume`, `companies`, `jobs` or `job_detail`; never serialize `window.location` or form fields. [OWASP logging exclusions](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

Allowed event fields are event/version ID, server receipt time, bounded event name, source (`browser` / `server`), consent version, pseudonymous measured subject when allowed, coarse foreground view and an allowlisted outcome. Backend billing events may include an internal plan revision through an explicit safe projection. Duration is bucketed or bounded; error values are public error codes, not exception strings. No arbitrary properties bag or automatic DOM capture is accepted. User-level browsing/job histories and per-user dashboards are outside scope.

## Event ownership and measurement reliability

| Event family                                      | Authority                      | Counting rules                                                                                                          |
| ------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Foreground views, upgrade/paywall/result exposure | Browser, with optional consent | Emit once per real SPA navigation/exposure, not every React render or filter keystroke; untrusted behavioral signal     |
| Analysis/matching attempts and completion         | Backend workflow               | Safe bounded outcome only; separate initial analysis, corrected-profile recalculation, initial matching and page append |
| Verified registration                             | Account workflow               | One business event per new verified account; repeat login callbacks deduplicated                                        |
| Checkout and paid activation                      | Billing workflow               | Server-created attempt and reconciled subscription/invoice state; never browser success parameters                      |
| Operational health                                | Backend metric counters        | Route template, outcome, bounded timing and environment; no persistent visitor identity or private request payload      |

Authenticate backend-generated events by internal ownership; a browser cannot claim registration, payment or Pro tier. Derive account subjects from the verified session and check analytics permission server-side. Client event timestamps are not authoritative. Bound collection request size/event batches, rate-limit ingestion and reject unknown names/properties; exclude collector calls from usage metrics to prevent feedback loops.

Deduplicate event IDs with a uniqueness constraint, use safe operation IDs for retried business events, and preserve legitimate repeated actions as separate attempts. Collect SPA exposure with deliberate effect ownership to avoid React development double effects. Multiple tabs for the same account count once for activity; multiple sessions still count as sessions. No permanent heartbeat runs in hidden tabs; the active-now estimate uses foreground events and a short-lived presence store, expiring within five minutes.

Analytics failure must not fail matching, login or Checkout. Operational counters can tolerate documented loss; billing and registration aggregates recover from authoritative records, while measured client-event loss is labeled and never fabricated. Use a bounded outbox/retry path for authoritative safe events without storing candidate payloads. Browser events are best effort with bounded retries. Daily aggregation is replayable/idempotent; support late billing corrections and a documented late-arrival window. Alert on ingestion/aggregation lag and rejection spikes.

## Storage, permissions and API

Follow [ARCHITECTURE](ARCHITECTURE.md): pure metric/window definitions in domain, collection/query/aggregation workflows in application, narrow analytics ports, PostgreSQL adapters in infrastructure and bounded APIs in the existing backend. The frontend consumes generated summary contracts. No separate analytics service or warehouse is required initially.

Proposed records and retention defaults, subject to privacy review:

| Record                   | Purpose                                                                                        | Retention                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| AnalyticsEvent           | Strict allowlisted measured events and safe operation IDs                                      | Thirty days                                                 |
| AccountActivityDay       | One permitted pseudonymous account/day row with minimal activity flags; no job or profile data | 120 days, enough for ninety-day charts plus rolling windows |
| AnalyticsJourney         | Consented guest-to-account/Checkout linkage                                                    | Thirty days                                                 |
| AnalyticsDailyAggregate  | Count/latency/funnel totals by metric version, day and approved segment                        | Twenty-four months, no individual identifiers               |
| AnalyticsMonthlySnapshot | Distinct calendar-month activity and billing snapshots computed before granular expiry         | Twenty-four months, no individual identifiers               |
| AnalyticsPresence        | Approximate last foreground activity for active-now                                            | Five minutes, expired automatically                         |

These new activity records are a proposed privacy boundary addition. Update privacy notices and implemented documentation before enabling them. Accounts still never store a resume/profile. Exact arbitrary rolling distinct queries outside granular retention are unavailable; do not reconstruct them by summing aggregate day counts. Account/billing history retention remains owned by the account/billing policy. Define deletion propagation to aggregates and backup expiry; suppress small segmented cohorts (proposed minimum ten subjects) while aggregate account/billing headline totals remain available to authorized admins.

Admin analytics requires `analytics.read`; money-related views additionally require `billing.analytics.read`. Catalog/pricing management does not automatically grant either. Use the planned MFA/admin session controls, bounded date ranges/segments and read-only queries. Audit access/export actions separately from measured public usage. CSV export is aggregate-only and should preserve suppression/coverage labels; no per-user or raw-event export is included.

Proposed endpoints:

- `POST /api/v1/analytics/events`: strict, consent-aware browser exposure collector; accepts no identity/tier supplied as trusted facts and no private input.
- `GET /api/v1/admin/analytics/overview`, `/audience`, `/funnel`, `/revenue`, `/health`: permission-checked summary series and definitions, with `asOf`, metric version, timezone, coverage and partial/stale flags.
- `GET /api/v1/admin/analytics/export`: authorized aggregate report for a bounded range, with the same suppression as the dashboard.

Compute indexed daily/account windows and preaggregate charts rather than repeatedly scanning raw events. Target five-minute refresh for overview/active usage, hourly funnel/billing reconciliation and daily retention snapshots. Presence remains an estimate even with frequent refresh. Scope queries by environment; production, staging and Stripe sandbox never mix. Cache admin summaries briefly behind authorization and never serve them from a public CDN. Regenerate OpenAPI contracts at implementation time.

## Implementation sequence and verification

1. **Definitions and permission policy:** approve metric dictionary, qualifying activity, privacy/consent decision and retention. Add safe event schemas and `analytics.read` / `billing.analytics.read`; no tracking begins in this planning phase.
2. **Authoritative overview:** build account totals, paid-access accounts, reconciled billing snapshots and identity-free service health. Revenue must reconcile to Stripe with documented differences before reporting MRR.
3. **Measured audience:** optional consent controls, minimal first-party collector, activity-day rows and Overview/Audience charts. Verify DAU/WAU/MAU with synthetic cross-tab/device activity and local-day boundaries.
4. **Product funnel and retention:** consented journeys, real rendered exposure events, seven-day conversions and D1/D7/D30 cohorts. Add dropout counts and mature/provisional labels.
5. **Admin integration and operations:** dashboard date/segment controls, aggregate exports, retention/deletion jobs, lag alerts, bounded query performance and release checks. Scheduled aggregation must run independently of the optional ingestion worker.

Behavior tests must cover duplicate delivery, retry versus rerun, login without activity, payment without activity, anonymous-to-account linkage, deleted/test/admin/bot exclusion, hidden-tab inactivity, consent refusal/withdrawal, empty denominators, late payment/refund correction, grandfathered Prices, currencies, cancelled-at-period-end subscriptions and permission revocation. A fixed set of six accounts active on different days should produce independently calculated DAU/WAU/MAU, proving that distinct windows are not summed.

Use timezone fixtures spanning Amsterdam daylight-saving changes and month ends; verify separate rolling and calendar-month charts. Feed synthetic private-looking resume/search values through normal flows and assert they never occur in collector payloads, database records, logs, exports or Stripe metadata. Verify rejected events cannot change payment/account counters and analytics downtime cannot break the product. Run root lint/types/contracts/tests/build and dedicated PostgreSQL retention/concurrency tests when code is implemented; manually check dashboard responsiveness, loading, failures, empty data, consent and access denial.

Current-code verification: the app has no analytics schema/collector or account activity model; Fastify logging is optional and the SPA manages query navigation directly. Existing [private API handling](../backend/src/api/private-resume-route.ts), [frontend navigation](../frontend/src/hooks/useLocationQuery.ts) and [billing/admin proposal](ACCOUNTS_BILLING_PLAN.md) are the integration points. External guidance was checked on 5 October 2026. No application or analytics behavior tests are claimed for this document-only increment.
