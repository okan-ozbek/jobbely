import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { createTestCheckout, currentAccount, listPlans } from '../../api/accounts.js';
import type { BillingPeriod, Plans } from '../../api/accounts.js';
import { ApiError } from '../../api/client.js';
import './pricing.css';

const names = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export function PricingPlans({
  onSignIn,
  signedIn = false,
  accountKey,
}: {
  onSignIn: () => void;
  signedIn?: boolean;
  accountKey?: string | null;
}) {
  const [plans, setPlans] = useState<Plans | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<{ url: string; period: BillingPeriod } | null>(null);
  const [reload, setReload] = useState(0);
  const active = useRef<AbortController | null>(null);
  const request = useRef<{ period: BillingPeriod; userId: string; id: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    listPlans(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setPlans(result);
          setError('');
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : 'Could not load pricing.');
        }
      });

    return () => controller.abort();
  }, [reload]);

  useEffect(() => () => active.current?.abort(), []);

  useEffect(() => {
    active.current?.abort();
    setCheckout(null);
    request.current = null;
    setBusy(false);
  }, [accountKey]);

  async function begin() {
    const controller = new AbortController();

    active.current?.abort();
    active.current = controller;
    setBusy(true);
    setError('');

    try {
      const account = await currentAccount(controller.signal);

      if (controller.signal.aborted) {
        return;
      }

      if (!account.user || !account.csrfToken) {
        onSignIn();

        return;
      }

      if (request.current?.period !== period || request.current.userId !== account.user.id) {
        request.current = { period, userId: account.user.id, id: crypto.randomUUID() };
      }

      const result = await createTestCheckout(
        period,
        request.current.id,
        account.csrfToken,
        controller.signal,
      );

      const url = new URL(result.url);

      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'checkout.stripe.com' ||
        url.username ||
        url.password ||
        url.port
      ) {
        throw new Error('Could not open Stripe checkout.');
      }

      if (!controller.signal.aborted) {
        setCheckout({ url: url.href, period });
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (failure instanceof ApiError && failure.code === 'authentication_required') {
          onSignIn();
        } else {
          setError(failure instanceof Error ? failure.message : 'Could not start test checkout.');
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }

  const offer = plans?.billingOptions.find((item) => item.key === period);

  return (
    <div
      className="pricing-plans"
      aria-busy={!plans || busy}
    >
      <div
        className="billing-periods"
        aria-label="Billing frequency"
      >
        {(['monthly', 'quarterly', 'yearly'] as const).map((key) => (
          <button
            key={key}
            aria-pressed={period === key}
            disabled={busy}
            onClick={() => {
              setPeriod(key);
              setCheckout(null);
            }}
          >
            {names[key]}
            {key !== 'monthly' && <span>Save {key === 'quarterly' ? '10' : '25'}%</span>}
          </button>
        ))}
      </div>
      {plans && offer ? (
        <>
          <div className="pricing-grid">
            <section className="pricing-card">
              <span className="plan-eyebrow">A place to start</span>
              <h3>Basic</h3>
              <p className="plan-amount">
                {money(0)}
                <span>/ month</span>
              </p>
              <p>Find your next opportunity, at your own pace.</p>
              <ul>
                <li>
                  <Check size={16} />
                  Public jobs and company directory
                </li>
                <li>
                  <Check size={16} />
                  Resume review and matching
                </li>
                <li>
                  <Check size={16} />
                  Links to original job listings
                </li>
              </ul>
              <button
                className="secondary-button"
                disabled={signedIn}
                onClick={onSignIn}
              >
                {signedIn ? 'Your current plan' : 'Create a free account'}
              </button>
            </section>
            <section className="pricing-card pricing-card-pro">
              <span className="plan-eyebrow">Your next chapter</span>
              <h3>Pro</h3>
              <p className="plan-amount">
                {money(Math.round(offer.amount / offer.months))}
                <span>/ month</span>
              </p>
              <p className="billing-total">
                {money(offer.amount)} billed{' '}
                {period === 'monthly'
                  ? 'every month'
                  : period === 'quarterly'
                    ? 'every 3 months'
                    : 'every year'}
                {offer.discountPercent > 0 && ` · Save ${offer.discountPercent}%`}
              </p>
              <ul>
                <li>
                  <Check size={16} />
                  Everything in Basic
                </li>
                <li>
                  <Check size={16} />
                  All eligible matches — planned
                </li>
                <li>
                  <Check size={16} />
                  Full match comparisons — planned
                </li>
              </ul>
              {checkout?.period === period ? (
                <a
                  className="primary-button"
                  href={checkout.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Continue to Stripe test checkout <ArrowUpRight size={16} />
                </a>
              ) : (
                <button
                  className="primary-button"
                  disabled={busy || !plans.billing.checkoutAvailable}
                  onClick={() => {
                    void begin();
                  }}
                >
                  {busy
                    ? 'Preparing checkout…'
                    : plans.billing.checkoutAvailable
                      ? 'Try Pro in test mode'
                      : 'Test checkout coming soon'}
                </button>
              )}
            </section>
          </div>
          <p className="pricing-test-note">
            Test mode · No real payment. Your account stays on Basic while subscriptions are being
            tested. Matching is currently available to everyone.
          </p>
        </>
      ) : (
        !error && (
          <p
            role="status"
            className="small-note"
          >
            Loading pricing…
          </p>
        )
      )}
      {error && (
        <p
          role="alert"
          className="account-error"
        >
          {error}{' '}
          {!plans && (
            <button
              className="account-text-button"
              onClick={() => setReload((value) => value + 1)}
            >
              Try again
            </button>
          )}
        </p>
      )}
    </div>
  );
}
