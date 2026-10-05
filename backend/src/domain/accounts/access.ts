export const accessPolicyVersion = 'access-1';

export const freeMatchLimit = 5;

export const paidPageLimit = 50;

export const paidCapabilities = ['ranked_matches.all', 'job_comparison.all'] as const;

export type PaidCapability = (typeof paidCapabilities)[number];

export interface PlanRevision {
  id: string;
  key: string;
  state: 'draft' | 'published' | 'retired';
  mode: 'test' | 'live';
  capabilities: readonly PaidCapability[];
  monthlyAmount: number;
  currency: string;
}

/** Normalized, reconciled server records; never client claims or raw Stripe objects. */
export interface SubscriptionAccess {
  userId: string;
  planRevisionId: string;
  mode: 'test' | 'live';
  status:
    | 'active'
    | 'past_due'
    | 'incomplete'
    | 'incomplete_expired'
    | 'trialing'
    | 'unpaid'
    | 'paused'
    | 'canceled';
  settledPeriodStart: string | null;
  settledPeriodEnd: string | null;
  restriction: 'none' | 'full_refund' | 'dispute';
}

export interface MatchingAccess {
  userId: string | null;
  planRevisionId: string | null;
  capabilities: readonly PaidCapability[];
  accessEndsAt: string | null;
  policyVersion: typeof accessPolicyVersion;
}

export class AccountAccessError extends Error {
  constructor(
    public readonly code: 'authentication_required' | 'access_unavailable' | 'upgrade_required',
    message: string,
  ) {
    super(message);
  }
}

export function freeAccess(userId: string | null = null): MatchingAccess {
  return {
    userId,
    planRevisionId: null,
    capabilities: [],
    accessEndsAt: null,
    policyVersion: accessPolicyVersion,
  };
}

export function subscriptionCapabilities(
  user: { id: string; state: 'active' | 'disabled' | 'deleted' },
  subscription: SubscriptionAccess | null,
  revisions: readonly PlanRevision[],
  mode: 'test' | 'live',
  now: Date,
): MatchingAccess {
  if (user.state !== 'active') {
    throw new AccountAccessError('authentication_required', 'Sign in to an active account.');
  }

  const fallback = freeAccess(user.id);

  if (!subscription) {
    return fallback;
  }

  if (subscription.userId !== user.id || subscription.mode !== mode) {
    throw new AccountAccessError('access_unavailable', 'Could not verify account access.');
  }

  const plan = revisions.find((revision) => revision.id === subscription.planRevisionId);

  if (
    !plan ||
    plan.state === 'draft' ||
    plan.mode !== mode ||
    !Number.isInteger(plan.monthlyAmount) ||
    plan.monthlyAmount <= 0 ||
    !/^[a-z]{3}$/.test(plan.currency) ||
    plan.capabilities.some((capability) => !paidCapabilities.includes(capability))
  ) {
    return fallback;
  }

  const start = Date.parse(subscription.settledPeriodStart ?? '');
  const end = Date.parse(subscription.settledPeriodEnd ?? '');
  const time = now.getTime();

  if (
    !Number.isFinite(time) ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > time ||
    end <= time ||
    start >= end ||
    subscription.restriction !== 'none' ||
    !['active', 'past_due'].includes(subscription.status)
  ) {
    return fallback;
  }

  return {
    userId: user.id,
    planRevisionId: plan.id,
    capabilities: [...plan.capabilities],
    accessEndsAt: new Date(end).toISOString(),
    policyVersion: accessPolicyVersion,
  };
}

export function hasCapability(access: MatchingAccess, capability: PaidCapability): boolean {
  return access.capabilities.includes(capability);
}
