import { freeMatchLimit, paidCapabilities } from './access.js';

export const proBillingOptions = [
  {
    key: 'monthly',
    amount: 795,
    currency: 'usd',
    interval: 'month',
    intervalCount: 1,
    months: 1,
    discountPercent: 0,
  },
  {
    key: 'quarterly',
    amount: Math.round(795 * 3 * 0.9),
    currency: 'usd',
    interval: 'month',
    intervalCount: 3,
    months: 3,
    discountPercent: 10,
  },
  {
    key: 'yearly',
    amount: Math.round(795 * 12 * 0.75),
    currency: 'usd',
    interval: 'year',
    intervalCount: 1,
    months: 12,
    discountPercent: 25,
  },
] as const;

export type BillingPeriod = (typeof proBillingOptions)[number]['key'];

export class BillingError extends Error {
  constructor(
    readonly code: 'billing_unavailable' | 'invalid_checkout',
    message: string,
  ) {
    super(message);
  }
}

/** Approved product offer; a draft, not a purchasable Stripe Price. */
export const initialPlans = [
  {
    key: 'free',
    name: 'Free',
    monthlyAmount: 0,
    currency: 'usd',
    interval: 'month' as const,
    previewLimit: freeMatchLimit,
    capabilities: [],
    purchasable: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    monthlyAmount: 795,
    currency: 'usd',
    interval: 'month' as const,
    previewLimit: null,
    capabilities: [...paidCapabilities],
    purchasable: false,
  },
];
