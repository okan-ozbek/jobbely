import { createHash } from 'node:crypto';
import type Stripe from 'stripe';
import type { TestBillingGateway } from '../../ports/billing.js';
import { BillingError, proBillingOptions } from '../../domain/accounts/plans.js';
import type { BillingPeriod } from '../../domain/accounts/plans.js';

export function matchesTestPrice(price: Stripe.Price, period: BillingPeriod) {
  const offer = proBillingOptions.find((item) => item.key === period)!;

  return (
    !price.livemode &&
    price.active &&
    price.currency === offer.currency &&
    price.unit_amount === offer.amount &&
    price.type === 'recurring' &&
    price.recurring?.interval === offer.interval &&
    price.recurring.interval_count === offer.intervalCount &&
    price.recurring.usage_type === 'licensed'
  );
}

export class StripeTestBilling implements TestBillingGateway {
  constructor(
    private readonly stripe: Stripe,
    private readonly prices: Record<BillingPeriod, string>,
    private readonly origin: string,
  ) {}

  async createCheckout(input: {
    userId: string;
    email: string | null;
    period: BillingPeriod;
    requestId: string;
  }) {
    try {
      const price = await this.stripe.prices.retrieve(this.prices[input.period]);

      if (!matchesTestPrice(price, input.period)) {
        throw new Error('Invalid sandbox price');
      }

      const metadata = { jobbely_user_id: input.userId, jobbely_period: input.period };

      const idempotencyKey = createHash('sha256')
        .update(JSON.stringify(['test-checkout', input.userId, input.period, input.requestId]))
        .digest('hex');

      const session = await this.stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          line_items: [{ price: price.id, quantity: 1 }],
          allowed_payment_method_types: ['card'],
          ...(input.email ? { customer_email: input.email } : {}),
          client_reference_id: input.userId,
          metadata,
          subscription_data: { metadata },
          success_url: `${this.origin}/?view=pricing&checkout_session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${this.origin}/?view=pricing&checkout=canceled`,
        },
        { idempotencyKey },
      );

      const url = new URL(session.url ?? '');

      if (
        session.livemode ||
        !session.id.startsWith('cs_test_') ||
        url.protocol !== 'https:' ||
        url.hostname !== 'checkout.stripe.com' ||
        url.username ||
        url.password ||
        url.port
      ) {
        throw new Error('Invalid sandbox checkout');
      }

      return { id: session.id, url: url.href };
    } catch {
      throw new BillingError(
        'billing_unavailable',
        'Test checkout is unavailable. Please try again later.',
      );
    }
  }

  async readCheckout(id: string) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(id, {
        expand: ['line_items.data.price'],
      });

      const period = proBillingOptions.find(
        (offer) => offer.key === session.metadata?.jobbely_period,
      )?.key;

      const line = session.line_items?.data[0];

      if (
        session.livemode ||
        session.id !== id ||
        !session.id.startsWith('cs_test_') ||
        session.mode !== 'subscription' ||
        !period ||
        session.metadata?.jobbely_user_id !== session.client_reference_id ||
        session.line_items?.data.length !== 1 ||
        session.line_items.has_more ||
        line?.quantity !== 1 ||
        !line.price ||
        line.price.id !== this.prices[period] ||
        !matchesTestPrice(line.price, period)
      ) {
        throw new Error('Invalid sandbox checkout');
      }

      return {
        userId: session.client_reference_id,
        period,
        complete: session.status === 'complete',
        paid: session.payment_status === 'paid',
      };
    } catch {
      throw new BillingError('invalid_checkout', 'This test checkout could not be verified.');
    }
  }
}
