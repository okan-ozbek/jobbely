import { describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { StripeTestBilling } from './stripe-test-billing.js';
import { TestBilling } from '../../application/accounts/test-billing.js';
import type { AccountSession } from '../../domain/accounts/identity.js';
import { proBillingOptions } from '../../domain/accounts/plans.js';

const prices = { monthly: 'price_monthly', quarterly: 'price_quarterly', yearly: 'price_yearly' };

const owner: AccountSession = {
  tokenHash: 'synthetic',
  csrfToken: 'synthetic',
  revokedAt: null,
  idleExpiresAt: '2099-01-01T00:00:00Z',
  absoluteExpiresAt: '2099-01-01T00:00:00Z',
  user: {
    id: 'synthetic-owner',
    email: 'synthetic@example.invalid',
    username: null,
    state: 'active',
  },
};

function fixture(
  overrides: { price?: Record<string, unknown>; session?: Record<string, unknown> } = {},
) {
  const requests: {
    path: string;
    method: string | undefined;
    body: URLSearchParams;
    idempotency: string | null;
  }[] = [];

  const stripe = new Stripe('sk_test_synthetic', {
    maxNetworkRetries: 0,
    httpClient: Stripe.createFetchHttpClient(async (input, init) => {
      const url = new URL(String(input));
      const body = new URLSearchParams(String(init?.body ?? ''));

      requests.push({
        path: url.pathname,
        method: init?.method,
        body,
        idempotency: new Headers(init?.headers).get('idempotency-key'),
      });

      const period = url.pathname.endsWith('price_quarterly')
        ? 'quarterly'
        : url.pathname.endsWith('price_yearly')
          ? 'yearly'
          : 'monthly';

      const offer = proBillingOptions.find((item) => item.key === period)!;

      const price = {
        id: prices[period],
        object: 'price',
        active: true,
        livemode: false,
        currency: 'usd',
        unit_amount: offer.amount,
        type: 'recurring',
        recurring: {
          interval: offer.interval,
          interval_count: offer.intervalCount,
          usage_type: 'licensed',
        },
        ...overrides.price,
      };

      const session = {
        id: 'cs_test_synthetic',
        object: 'checkout.session',
        livemode: false,
        mode: 'subscription',
        client_reference_id: owner.user.id,
        metadata: { jobbely_user_id: owner.user.id, jobbely_period: 'monthly' },
        url: 'https://checkout.stripe.com/c/pay/cs_test_synthetic',
        status: 'complete',
        payment_status: 'paid',
        line_items: { data: [{ quantity: 1, price }], has_more: false },
        ...overrides.session,
      };

      return new Response(JSON.stringify(url.pathname.includes('/prices/') ? price : session), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  });

  return { gateway: new StripeTestBilling(stripe, prices, 'https://jobbely.example'), requests };
}

describe('Stripe sandbox checkout', () => {
  it('uses the approved USD recurring amounts including integer-cent rounding', () => {
    expect(
      proBillingOptions.map((offer) => [
        offer.key,
        offer.amount,
        offer.interval,
        offer.intervalCount,
        offer.discountPercent,
      ]),
    ).toEqual([
      ['monthly', 795, 'month', 1, 0],
      ['quarterly', 2147, 'month', 3, 10],
      ['yearly', 7155, 'year', 1, 25],
    ]);
  });

  it('creates each subscription with server prices and returns only a Stripe hosted URL', async () => {
    for (const offer of proBillingOptions) {
      const { gateway, requests } = fixture();

      const result = await gateway.createCheckout({
        userId: owner.user.id,
        email: owner.user.email,
        period: offer.key,
        requestId: 'synthetic-attempt',
      });

      const create = requests.find((request) => request.method === 'POST')!;

      expect(result.url).toBe('https://checkout.stripe.com/c/pay/cs_test_synthetic');
      expect(create.body.get('mode')).toBe('subscription');
      expect(create.body.get('line_items[0][price]')).toBe(prices[offer.key]);
      expect(create.body.get('line_items[0][quantity]')).toBe('1');
      expect(create.body.get('client_reference_id')).toBe(owner.user.id);
      expect(create.body.get('subscription_data[metadata][jobbely_period]')).toBe(offer.key);

      expect(create.body.get('success_url')).toBe(
        'https://jobbely.example/?view=pricing&checkout_session_id={CHECKOUT_SESSION_ID}',
      );

      expect(create.body.toString()).not.toMatch(/resume|password|skill/);
    }
  });

  it('keeps retry idempotency stable and separates owners and billing periods', async () => {
    const { gateway, requests } = fixture();

    const input = {
      userId: owner.user.id,
      email: owner.user.email,
      period: 'monthly' as const,
      requestId: 'same-attempt',
    };

    await gateway.createCheckout(input);
    await gateway.createCheckout(input);
    await gateway.createCheckout({ ...input, userId: 'another-owner' });
    await gateway.createCheckout({ ...input, period: 'quarterly' });

    const keys = requests
      .filter((request) => request.method === 'POST')
      .map((request) => request.idempotency);

    expect(keys[0]).toBe(keys[1]);
    expect(new Set(keys).size).toBe(3);
  });

  it.each([
    { livemode: true },
    { unit_amount: 1 },
    { currency: 'eur' },
    { active: false },
    { recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } },
  ])('rejects mismatched or live prices before checkout creation: %j', async (price) => {
    const { gateway, requests } = fixture({ price });

    await expect(
      gateway.createCheckout({
        userId: owner.user.id,
        email: owner.user.email,
        period: 'monthly',
        requestId: 'attempt',
      }),
    ).rejects.toThrow('Test checkout is unavailable');

    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it.each([
    { livemode: true },
    { id: 'cs_live_synthetic' },
    { url: 'https://attacker.invalid/pay' },
    { url: 'http://checkout.stripe.com/pay' },
  ])('rejects unsafe or live checkout responses: %j', async (session) => {
    const { gateway } = fixture({ session });

    await expect(
      gateway.createCheckout({
        userId: owner.user.id,
        email: owner.user.email,
        period: 'monthly',
        requestId: 'attempt',
      }),
    ).rejects.toThrow('Test checkout is unavailable');
  });

  it('verifies owner, expected price and paid status without issuing access', async () => {
    const { gateway } = fixture();
    const service = new TestBilling(gateway);

    expect(await service.status(owner, 'cs_test_synthetic')).toEqual({
      mode: 'test',
      period: 'monthly',
      complete: true,
      paid: true,
    });

    await expect(
      service.status(
        { ...owner, user: { ...owner.user, id: 'another-owner' } },
        'cs_test_synthetic',
      ),
    ).rejects.toThrow('for your account');

    const unpaid = new TestBilling(
      fixture({ session: { status: 'open', payment_status: 'unpaid' } }).gateway,
    );

    expect(await unpaid.status(owner, 'cs_test_synthetic')).toMatchObject({
      complete: false,
      paid: false,
    });
  });

  it.each([
    { mode: 'payment' },
    { livemode: true },
    { metadata: { jobbely_user_id: 'attacker', jobbely_period: 'monthly' } },
    { line_items: { data: [], has_more: false } },
  ])('rejects unexpected returned sessions: %j', async (session) => {
    await expect(fixture({ session }).gateway.readCheckout('cs_test_synthetic')).rejects.toThrow(
      'could not be verified',
    );
  });
});
