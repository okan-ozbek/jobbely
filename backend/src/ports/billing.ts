import type { BillingPeriod } from '../domain/accounts/plans.js';

export interface TestBillingGateway {
  createCheckout(input: {
    userId: string;
    email: string | null;
    period: BillingPeriod;
    requestId: string;
  }): Promise<{ id: string; url: string }>;
  readCheckout(
    id: string,
  ): Promise<{ userId: string | null; period: BillingPeriod; complete: boolean; paid: boolean }>;
}
