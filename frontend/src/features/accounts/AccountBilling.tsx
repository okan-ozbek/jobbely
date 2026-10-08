import { ArrowUpRight, CreditCard, FileClock, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listPlans } from '../../api/accounts.js';
import type { Plans } from '../../api/accounts.js';

export function AccountBilling({
  accountKey,
  onPricing,
}: {
  accountKey: string;
  onPricing: () => void;
}) {
  const [plans, setPlans] = useState<Plans | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setError('');
    setPlans(null);

    listPlans(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setPlans(result);
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            failure instanceof Error ? failure.message : 'Could not load billing information.',
          );
        }
      });

    return () => controller.abort();
  }, [accountKey, retry]);

  return (
    <div className="account-billing">
      <section className="dashboard-plan-card">
        <div>
          <span className="dashboard-plan-icon">
            <Sparkles size={24} />
          </span>
          <span className="plan-eyebrow">Your current plan</span>
          <h2>
            Free<span>Included</span>
          </h2>
          <p>A clear starting point. Public jobs, resume review and matching.</p>
        </div>
        <button
          className="dashboard-button"
          onClick={onPricing}
        >
          Explore Pro <ArrowUpRight size={16} />
        </button>
      </section>
      <div className="billing-detail-grid">
        <section className="dashboard-panel">
          <span className="dashboard-feature-icon">
            <CreditCard size={21} />
          </span>
          <h2>Payment details</h2>
          <p className="dashboard-body-copy">
            Payments are handled through Stripe. Payment methods and billing details will be
            available when paid plans launch.
          </p>
          <span className="billing-security">
            <ShieldCheck size={15} />
            Card details stay with Stripe
          </span>
        </section>
        <section className="dashboard-panel">
          <span className="dashboard-feature-icon">
            <Sparkles size={21} />
          </span>
          <h2>Stripe checkout</h2>
          {plans ? (
            <>
              <span
                className={`billing-connection${plans.billing.checkoutAvailable ? ' ready' : ''}`}
              >
                <i />
                {plans.billing.checkoutAvailable ? 'Test checkout ready' : 'Awaiting configuration'}
              </span>
              <p className="dashboard-body-copy">
                Pro checkout is a sandbox preview. It does not charge real money or change your Free
                plan.
              </p>
            </>
          ) : error ? (
            <p
              className="account-error"
              role="alert"
            >
              {error}{' '}
              <button
                className="account-text-button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Try again
              </button>
            </p>
          ) : (
            <p
              className="dashboard-body-copy"
              role="status"
            >
              Checking checkout availability…
            </p>
          )}
        </section>
      </div>
      <section className="dashboard-panel subscription-history">
        <div className="dashboard-panel-heading">
          <div>
            <h2>Subscription history</h2>
            <p>Your plans, payments and receipts, in one place.</p>
          </div>
          <FileClock size={20} />
        </div>
        <div className="billing-table-wrap">
          <table>
            <caption className="sr-only">Subscription history availability</caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4}>
                  <div className="billing-history-empty">
                    <FileClock size={29} />
                    <h3>A fresh start.</h3>
                    <p>
                      Billing history is not available during the preview.
                      <br />
                      Your subscriptions and receipts will appear here when billing launches.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
