import type { TestBillingGateway } from '../../ports/billing.js';
import type { AccountSession } from '../../domain/accounts/identity.js';
import { BillingError } from '../../domain/accounts/plans.js';
import type { BillingPeriod } from '../../domain/accounts/plans.js';

/** Sandbox checkout only. No production entitlement is issued by this workflow. */
export class TestBilling {
  constructor(private readonly gateway: TestBillingGateway) {}

  checkout(session: AccountSession, period: BillingPeriod, requestId: string) {
    return this.gateway.createCheckout({
      userId: session.user.id,
      email: session.user.email,
      period,
      requestId,
    });
  }

  async status(session: AccountSession, id: string) {
    const result = await this.gateway.readCheckout(id);

    if (result.userId !== session.user.id) {
      throw new BillingError(
        'invalid_checkout',
        'This checkout could not be verified for your account.',
      );
    }

    return {
      period: result.period,
      complete: result.complete,
      paid: result.paid,
      mode: 'test' as const,
    };
  }
}
