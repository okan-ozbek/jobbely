import { freeMatchLimit, paidCapabilities } from './access.js';

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
