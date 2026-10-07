import { useEffect, useState } from 'react';
import { testCheckoutStatus } from '../../api/accounts.js';
import { PricingPlans } from './PricingPlans.js';

export function PricingPage({
  onSignIn,
  checkoutId,
  canceled,
  accountKey,
}: {
  onSignIn: () => void;
  checkoutId: string | null;
  canceled: boolean;
  accountKey: string | null;
}) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setStatus('');
    setError('');

    if (!checkoutId) {
      return;
    }

    const controller = new AbortController();

    setStatus('Checking your test checkout…');

    testCheckoutStatus(checkoutId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setStatus(
            result.complete && result.paid
              ? 'Your test payment was confirmed by Stripe. Your account stays on Basic during testing.'
              : 'Your test payment has not been confirmed yet. Refresh this page after completing checkout.',
          );
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setStatus('');

          setError(
            failure instanceof Error ? failure.message : 'Could not verify your test payment.',
          );
        }
      });

    return () => controller.abort();
  }, [checkoutId, accountKey]);

  return (
    <section className="pricing-page">
      <div className="pricing-heading">
        <span className="plan-eyebrow">Simple plans. More possibilities.</span>
        <h1>
          Your next step.
          <br />
          <span>Your choice.</span>
        </h1>
        <p>Start with Basic. Explore Pro, with a billing rhythm that suits you.</p>
      </div>
      {status && (
        <p
          className="pricing-status"
          role="status"
        >
          {status}
        </p>
      )}
      {canceled && !checkoutId && (
        <p
          className="pricing-status"
          role="status"
        >
          Checkout canceled. Your account stays on Basic.
        </p>
      )}
      {error && (
        <p
          className="account-error"
          role="alert"
        >
          {error}
        </p>
      )}
      <PricingPlans
        onSignIn={onSignIn}
        signedIn={!!accountKey}
        accountKey={accountKey}
      />
    </section>
  );
}
