import { describe, expect, it } from 'vitest';
import { freeAccess, paidCapabilities, subscriptionCapabilities } from './access.js';
import type { PlanRevision, SubscriptionAccess } from './access.js';
import { initialPlans } from './plans.js';

const now = new Date('2026-10-05T12:00:00Z');
const user = { id: 'synthetic-user', state: 'active' as const };

const plan: PlanRevision = {
  id: 'pro-original',
  key: 'pro',
  state: 'published',
  mode: 'test',
  capabilities: paidCapabilities,
  monthlyAmount: 795,
  currency: 'usd',
};

const subscription: SubscriptionAccess = {
  userId: user.id,
  planRevisionId: plan.id,
  mode: 'test',
  status: 'active',
  settledPeriodStart: '2026-10-01T12:00:00Z',
  settledPeriodEnd: '2026-11-01T12:00:00Z',
  restriction: 'none',
};

describe('subscription capability policy', () => {
  it('keeps guest and registered Free access equivalent and the approved offer non-purchasable', () => {
    expect(freeAccess().capabilities).toEqual(freeAccess(user.id).capabilities);
    expect(subscriptionCapabilities(user, null, [plan], 'test', now).capabilities).toEqual([]);

    expect(initialPlans[1]).toMatchObject({
      monthlyAmount: 795,
      currency: 'usd',
      interval: 'month',
      purchasable: false,
    });
  });

  it.each(['active', 'past_due'] as const)(
    'grants only settled, unexpired coverage for %s',
    (status) => {
      expect(
        subscriptionCapabilities(user, { ...subscription, status }, [plan], 'test', now),
      ).toMatchObject({
        capabilities: paidCapabilities,
        planRevisionId: plan.id,
        accessEndsAt: '2026-11-01T12:00:00.000Z',
      });
    },
  );

  it.each([
    'incomplete',
    'incomplete_expired',
    'trialing',
    'unpaid',
    'paused',
    'canceled',
  ] as const)('does not grant access from %s status', (status) => {
    expect(
      subscriptionCapabilities(user, { ...subscription, status }, [plan], 'test', now).capabilities,
    ).toEqual([]);
  });

  it.each([
    { settledPeriodStart: null },
    { settledPeriodEnd: null },
    { settledPeriodEnd: 'invalid' },
    { settledPeriodEnd: now.toISOString() },
    { settledPeriodStart: '2027-01-01T00:00:00Z' },
    { restriction: 'full_refund' as const },
    { restriction: 'dispute' as const },
  ])('fails closed for incomplete or suspended paid coverage %j', (change) => {
    expect(
      subscriptionCapabilities(user, { ...subscription, ...change }, [plan], 'test', now)
        .capabilities,
    ).toEqual([]);
  });

  it('retains historical retired capabilities without adopting a new revision', () => {
    const newer = { ...plan, id: 'new-pro', capabilities: [] };

    expect(
      subscriptionCapabilities(
        user,
        subscription,
        [{ ...plan, state: 'retired' }, newer],
        'test',
        now,
      ).capabilities,
    ).toEqual(paidCapabilities);
  });

  it.each([
    { state: 'draft' as const },
    { monthlyAmount: 0 },
    { monthlyAmount: 7.95 },
    { mode: 'live' as const },
  ])('rejects an unapproved plan %j', (change) => {
    expect(
      subscriptionCapabilities(user, subscription, [{ ...plan, ...change }], 'test', now)
        .capabilities,
    ).toEqual([]);
  });

  it('rejects another account or billing environment instead of silently trusting it', () => {
    expect(() =>
      subscriptionCapabilities(
        user,
        { ...subscription, userId: 'someone-else' },
        [plan],
        'test',
        now,
      ),
    ).toThrow('Could not verify');

    expect(() => subscriptionCapabilities(user, subscription, [plan], 'live', now)).toThrow(
      'Could not verify',
    );

    expect(() =>
      subscriptionCapabilities({ ...user, state: 'disabled' }, subscription, [plan], 'test', now),
    ).toThrow('active account');
  });
});
