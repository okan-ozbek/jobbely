import { useEffect, useState } from 'react';
import { ArrowDown, ChevronDown, Compass, ShieldCheck, Sparkles } from 'lucide-react';
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
        <span className="pricing-kicker">
          <Sparkles size={14} /> A little clarity. A world of possibility.
        </span>
        <h1>
          Invest in your
          <br />
          <span>next chapter.</span>
        </h1>
        <p>
          Good opportunities start with a clearer picture.
          <br />
          Find your pace, choose your plan, and move forward.
        </p>
        <span className="pricing-heading-note">
          Start free. Explore what comes next. <ArrowDown size={13} />
        </span>
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
      <div className="pricing-benefits">
        <div>
          <Compass size={21} />
          <h3>Go straight to the source.</h3>
          <p>Discover public employer listings and apply on the original company site.</p>
        </div>
        <div>
          <Sparkles size={21} />
          <h3>See the bigger picture.</h3>
          <p>Review your experience and understand how it relates to a role.</p>
        </div>
        <div>
          <ShieldCheck size={21} />
          <h3>Keep your story yours.</h3>
          <p>Your resume stays transient. You decide what to share with employers.</p>
        </div>
      </div>
      <section className="pricing-faq">
        <div>
          <span className="plan-eyebrow">A few things you might wonder</span>
          <h2>A little more clarity.</h2>
          <p>Simple answers before your next step.</p>
        </div>
        <div className="pricing-faq-list">
          {[
            [
              'Can I start for free?',
              'Yes. Basic gives you public job discovery, resume review and matching. Matching is currently available to everyone, with no card required.',
            ],
            [
              'How do the billing options work?',
              'Monthly is billed each month. Quarterly bills three months together with 10% off. Yearly bills twelve months together with 25% off. The exact recurring bill is shown on your selected plan.',
            ],
            [
              'Is Pro available now?',
              'Pro is in preview. Configured checkout uses Stripe test mode and does not charge real money or change your Basic access. The additional Pro features are planned.',
            ],
            [
              'What happens to my resume?',
              'Your resume and reviewed profile stay in this tab while you explore. Reloading, clearing your resume or ending your account session clears that private state.',
            ],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown size={17} />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </section>
  );
}
