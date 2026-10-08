import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Compass, LockKeyhole, Sparkles } from 'lucide-react';
import { createTestCheckout, currentAccount, listPlans } from '../../api/accounts.js';
import type { BillingPeriod, Plans } from '../../api/accounts.js';
import { ApiError } from '../../api/client.js';
import { PlanCard } from './PlanCard.js';
import './pricing.css';

const names = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export function PricingPlans({
  onSignIn,
  accountKey,
}: {
  onSignIn: () => void;
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

  const periods = ['monthly', 'quarterly', 'yearly'] as const;
  const offer = plans?.billingOptions.find((item) => item.key === period);

  return (
    <div
      className="pricing-plans"
      aria-busy={(!plans && !error) || busy}
    >
      <div
        className="billing-periods"
        role="group"
        aria-label="Billing frequency"
      >
        <span
          className="billing-indicator"
          aria-hidden="true"
          style={{ transform: `translateX(${periods.indexOf(period) * 100}%)` }}
        />
        {periods.map((key) => {
          const discount = plans?.billingOptions.find((item) => item.key === key)?.discountPercent;

          return (
            <button
              key={key}
              aria-pressed={period === key}
              disabled={busy}
              onClick={() => {
                setPeriod(key);
                setCheckout(null);
                setError('');
              }}
            >
              {names[key]}
              {!!discount && <span>Save {discount}%</span>}
            </button>
          );
        })}
      </div>
      {plans && offer ? (
        <>
          <div className="pricing-grid">
            <PlanCard>
              <div className="plan-card-top">
                <span className="plan-icon">
                  <Compass size={24} />
                </span>
                <span className="plan-tag">Free to get started</span>
              </div>
              <h2>Free</h2>
              <p className="plan-description">A clearer starting point for your next move.</p>
              <div className="plan-price-block">
                <p className="plan-amount">
                  {money(0)}
                  <span>/ month</span>
                </p>
                <p className="billing-total">Free today. No card needed.</p>
              </div>
              <div className="plan-divider" />
              <span className="plan-list-heading">Your essentials, covered</span>
              <ul>
                <li>
                  <Check size={17} />
                  Public jobs and company directory
                </li>
                <li>
                  <Check size={17} />
                  Resume review and job matching
                </li>
                <li>
                  <Check size={17} />
                  Explained comparisons
                </li>
                <li>
                  <Check size={17} />
                  Apply on the original company site
                </li>
              </ul>
              <p className="plan-bottom-note">Space to explore. A place to begin.</p>
            </PlanCard>
            <PlanCard pro>
              <div className="plan-card-top">
                <span className="plan-icon">
                  <Sparkles size={24} />
                </span>
                <span className="plan-tag">Your next chapter · Preview</span>
              </div>
              <h2>
                Pro
                <span
                  className="pro-title-star"
                  aria-hidden="true"
                >
                  ✦
                </span>
              </h2>
              <p className="plan-description">More room for the possibilities ahead.</p>
              <div
                className="plan-price-block"
                key={period}
              >
                <p className="plan-amount">
                  {money(Math.round(offer.amount / offer.months))}
                  <span>/ month</span>
                </p>
                <p className="billing-total">
                  {money(offer.amount)} billed{' '}
                  {period === 'monthly'
                    ? 'monthly'
                    : period === 'quarterly'
                      ? 'every 3 months'
                      : 'yearly'}
                </p>
                {offer.discountPercent > 0 && (
                  <span className="plan-saving">
                    Save {offer.discountPercent}% compared with monthly
                  </span>
                )}
              </div>
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
                      ? 'Explore Pro in test mode'
                      : 'Pro checkout coming soon'}
                  <ArrowRight size={16} />
                </button>
              )}
              <div className="plan-divider" />
              <span className="plan-list-heading">Built around your next step</span>
              <ul>
                <li>
                  <Check size={17} />
                  Everything in Free
                </li>
                <li>
                  <Sparkles size={17} />
                  All eligible matches<span className="feature-preview">Planned</span>
                </li>
                <li>
                  <Sparkles size={17} />
                  Full match comparisons<span className="feature-preview">Planned</span>
                </li>
                <li>
                  <Check size={17} />A choice of monthly, quarterly or yearly billing
                </li>
              </ul>
              <p className="plan-bottom-note">A thoughtful investment in what comes next.</p>
            </PlanCard>
          </div>
          <div className="pricing-assurance">
            <LockKeyhole size={15} />
            <span>Hosted checkout with Stripe</span>
            <span aria-hidden="true">·</span>
            <span>No card details stored by Jobbely</span>
          </div>
          <p className="pricing-test-note">
            Pro is in preview. Checkout uses Stripe test mode, with no real payment or plan change.
            Matching is currently available to everyone on Free.
          </p>
        </>
      ) : (
        !error && (
          <div
            className="pricing-grid pricing-loading"
            role="status"
            aria-label="Loading pricing"
          >
            <div className="pricing-card" />
            <div className="pricing-card" />
            <span className="sr-only">Loading pricing…</span>
          </div>
        )
      )}
      {error && (
        <p
          role="alert"
          className="account-error pricing-status"
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
