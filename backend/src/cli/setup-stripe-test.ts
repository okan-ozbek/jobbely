import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import Stripe from 'stripe';
import { proBillingOptions } from '../domain/accounts/plans.js';
import { matchesTestPrice } from '../infrastructure/accounts/stripe-test-billing.js';

async function setup() {
  const secret = process.env.STRIPE_SECRET_KEY;

  if (!secret || !/^sk_test_[A-Za-z0-9]+$/.test(secret)) {
    throw new Error(
      'Set STRIPE_SECRET_KEY to a sandbox sk_test_ key in backend/.env first. Live keys are not accepted.',
    );
  }

  const stripe = new Stripe(secret, { timeout: 10_000, maxNetworkRetries: 1 });

  const product = await stripe.products
    .create(
      {
        id: 'jobbely_pro_test_v1',
        name: 'Jobbely Pro (test)',
        description: 'Jobbely sandbox subscription. No production access.',
      },
      { idempotencyKey: 'jobbely-pro-test-product-v1' },
    )
    .catch(async () => stripe.products.retrieve('jobbely_pro_test_v1'));

  if (product.livemode || product.deleted) {
    throw new Error('Expected a Jobbely sandbox product.');
  }

  const settings: Record<string, string> = {};

  for (const offer of proBillingOptions) {
    const lookupKey = `jobbely_pro_${offer.key}_test_v1`;
    const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 2 });

    const price =
      existing.data[0] ??
      (await stripe.prices.create(
        {
          product: product.id,
          currency: offer.currency,
          unit_amount: offer.amount,
          recurring: { interval: offer.interval, interval_count: offer.intervalCount },
          lookup_key: lookupKey,
        },
        { idempotencyKey: lookupKey },
      ));

    if (
      existing.data.length > 1 ||
      !matchesTestPrice(price, offer.key) ||
      price.product !== product.id
    ) {
      throw new Error(`The ${offer.key} test price does not match the approved offer.`);
    }

    settings[`STRIPE_PRICE_${offer.key.toUpperCase()}`] = price.id;
  }

  const path = new URL('../../.env', import.meta.url);

  const previous = await readFile(path, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    return '';
  });

  const newline = previous.includes('\r\n') ? '\r\n' : '\n';

  const lines = previous
    .split(/\r?\n/)
    .filter((line) => !/^\s*STRIPE_PRICE_(MONTHLY|QUARTERLY|YEARLY)\s*=/.test(line));

  const next = `${lines.join(newline)}${newline}${Object.entries(settings)
    .map(([key, value]) => `${key}=${value}`)
    .join(newline)}${newline}`;

  await writeFile(path, next, { mode: 0o600 });

  console.log(
    'Saved the three verified Stripe test price IDs to backend/.env. Restart the API to enable test checkout.',
  );
}

setup().catch(() => {
  console.error(
    'Stripe test setup failed. Check the sandbox key, network access and existing Jobbely test prices. No secret values are printed.',
  );

  process.exitCode = 1;
});
