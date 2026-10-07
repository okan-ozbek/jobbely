import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from './app.js';
import { Accounts } from '../application/accounts/accounts.js';
import { MemoryAccounts } from '../infrastructure/storage/accounts-memory.js';
import { MemoryJobRepository } from '../infrastructure/storage/memory.js';
import { JobCatalog } from '../application/catalog.js';
import type { IdentityProvider } from '../ports/accounts.js';
import { randomUUID } from 'node:crypto';
import { TestBilling } from '../application/accounts/test-billing.js';
import type { TestBillingGateway } from '../ports/billing.js';

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup(origin = 'http://127.0.0.1:5173', billing?: TestBilling) {
  const repository = new MemoryJobRepository();
  const accountRepository = new MemoryAccounts();

  const provider: IdentityProvider = {
    name: 'github',
    authorizationUrl: ({ state }) => `https://github.com/login/oauth/authorize?state=${state}`,
    verify: async () => ({
      provider: 'github',
      issuer: 'https://github.com',
      subject: '123',
      email: 'synthetic@example.invalid',
    }),
  };

  const app = await createApp({
    repository,
    catalog: new JobCatalog(repository, [], [], 'demo'),
    origin,
    accounts: new Accounts(accountRepository, [provider]),
    billing,
  });

  apps.push(app);

  async function login() {
    const started = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/github/start',
      headers: { origin },
      payload: {},
    });

    const cookie = started.cookies[0]!;
    const state = new URL(started.json().authorizationUrl).searchParams.get('state')!;

    const completed = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/github/callback?state=${state}&code=synthetic-code`,
      headers: { cookie: `${cookie.name}=${cookie.value}` },
    });

    return {
      started,
      completed,
      cookie: `${completed.cookies[0]!.name}=${completed.cookies[0]!.value}`,
    };
  }

  return { app, login, origin, accountRepository };
}

describe('account and offer API', () => {
  it('guards test checkout with Origin, session, CSRF and server-only price selection', async () => {
    let captured: Parameters<TestBillingGateway['createCheckout']>[0] | null = null;
    let statusOwner = '';

    const billing = new TestBilling({
      createCheckout: async (input) => {
        captured = input;
        statusOwner = input.userId;

        return {
          id: 'cs_test_synthetic',
          url: 'https://checkout.stripe.com/c/pay/cs_test_synthetic',
        };
      },
      readCheckout: async () => ({
        userId: statusOwner,
        period: 'quarterly',
        complete: true,
        paid: true,
      }),
    });

    const { app, login, origin } = await setup('https://example.invalid', billing);
    const { cookie } = await login();
    const current = await app.inject({ url: '/api/v1/account', headers: { cookie } });
    const csrf = current.json().csrfToken;
    const payload = { period: 'quarterly', requestId: randomUUID() };

    for (const [headers, body, expected] of [
      [{ origin }, payload, 401],
      [{ origin, cookie }, payload, 401],
      [{ cookie, 'x-csrf-token': csrf }, payload, 403],
      [{ origin: 'https://attacker.invalid', cookie, 'x-csrf-token': csrf }, payload, 403],
      [{ origin, cookie, 'x-csrf-token': csrf }, { ...payload, price: 'price_attacker' }, 400],
      [{ origin, cookie, 'x-csrf-token': csrf }, { ...payload, userId: 'attacker' }, 400],
      [
        { origin, cookie, 'x-csrf-token': csrf },
        { ...payload, returnUrl: 'https://attacker.invalid' },
        400,
      ],
    ] as const) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/billing/checkout',
            headers,
            payload: body,
          })
        ).statusCode,
      ).toBe(expected);

      expect(captured).toBeNull();
    }

    const checkout = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      headers: { origin, cookie, 'x-csrf-token': csrf },
      payload,
    });

    expect(checkout.statusCode).toBe(200);
    expect(checkout.headers['cache-control']).toBe('no-store');

    expect(captured).toEqual({
      userId: current.json().user.id,
      email: current.json().user.email,
      period: 'quarterly',
      requestId: payload.requestId,
    });

    expect((await app.inject('/api/v1/billing/checkout/cs_test_synthetic')).statusCode).toBe(401);

    expect(
      (await app.inject({ url: '/api/v1/billing/checkout/cs_live_synthetic', headers: { cookie } }))
        .statusCode,
    ).toBe(400);

    expect(
      (
        await app.inject({ url: '/api/v1/billing/checkout/cs_test_synthetic', headers: { cookie } })
      ).json(),
    ).toMatchObject({ paid: true, mode: 'test' });

    statusOwner = 'another-owner';

    expect(
      (await app.inject({ url: '/api/v1/billing/checkout/cs_test_synthetic', headers: { cookie } }))
        .statusCode,
    ).toBe(400);

    expect(
      (await app.inject({ url: '/api/v1/account', headers: { cookie } })).json().access
        .capabilities,
    ).toEqual([]);
  });

  it('reports unconfigured test checkout without enabling any payment or access', async () => {
    const { app, origin, login } = await setup();
    const { cookie } = await login();
    const current = await app.inject({ url: '/api/v1/account', headers: { cookie } });

    expect((await app.inject('/api/v1/plans')).json()).toMatchObject({
      billing: { mode: 'test', checkoutAvailable: false },
      billingOptions: [
        { key: 'monthly', amount: 795 },
        { key: 'quarterly', amount: 2147 },
        { key: 'yearly', amount: 7155 },
      ],
    });

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/billing/checkout',
          headers: { origin, cookie, 'x-csrf-token': current.json().csrfToken },
          payload: { period: 'monthly', requestId: randomUUID() },
        })
      ).statusCode,
    ).toBe(503);
  });

  it('deletes only the authenticated account after explicit confirmation, origin and CSRF validation', async () => {
    const { app, login, origin, accountRepository } = await setup('https://example.invalid');
    const first = await login();
    const second = await login();
    const current = await app.inject({ url: '/api/v1/account', headers: { cookie: first.cookie } });
    const csrf = current.json().csrfToken;

    for (const request of [
      { headers: { origin }, payload: { confirm: true }, status: 401 },
      { headers: { origin, cookie: first.cookie }, payload: { confirm: true }, status: 401 },
      {
        headers: { cookie: first.cookie, 'x-csrf-token': csrf },
        payload: { confirm: true },
        status: 403,
      },
      {
        headers: { origin: 'https://attacker.invalid', cookie: first.cookie, 'x-csrf-token': csrf },
        payload: { confirm: true },
        status: 403,
      },
      { headers: { origin, cookie: first.cookie, 'x-csrf-token': csrf }, payload: {}, status: 400 },
      {
        headers: { origin, cookie: first.cookie, 'x-csrf-token': csrf },
        payload: { confirm: false },
        status: 400,
      },
      {
        headers: { origin, cookie: first.cookie, 'x-csrf-token': csrf },
        payload: { confirm: true, userId: 'other' },
        status: 400,
      },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/account/delete',
        headers: request.headers,
        payload: request.payload,
      });

      expect(response.statusCode).toBe(request.status);
      expect(accountRepository.users.size).toBe(1);
    }

    const removed = await app.inject({
      method: 'POST',
      url: '/api/v1/account/delete',
      headers: { origin, cookie: first.cookie, 'x-csrf-token': csrf },
      payload: { confirm: true },
    });

    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ deleted: true });
    expect(removed.headers['cache-control']).toBe('no-store');
    expect(removed.cookies).toHaveLength(2);

    expect(
      removed.cookies.every((cookie) => cookie.maxAge === 0 && cookie.secure && cookie.httpOnly),
    ).toBe(true);

    expect(accountRepository.users.size).toBe(0);

    expect(
      (await app.inject({ url: '/api/v1/account', headers: { cookie: second.cookie } })).statusCode,
    ).toBe(401);
  });

  it('exposes a draft $7.95 monthly offer without enabling purchase or changing matching', async () => {
    const { app } = await setup();
    const plans = await app.inject('/api/v1/plans');
    const account = await app.inject('/api/v1/account');

    expect(plans.json()).toMatchObject({ matchingPolicy: { enabled: false, previewLimit: 5 } });

    expect(plans.json().items[1]).toMatchObject({
      monthlyAmount: 795,
      currency: 'usd',
      purchasable: false,
    });

    expect(account.json()).toMatchObject({
      user: null,
      csrfToken: null,
      access: { capabilities: [] },
    });

    expect(account.headers['cache-control']).toBe('no-store');
  });

  it('sets an opaque HttpOnly cookie and exposes only account identity, capabilities and CSRF', async () => {
    const { app, login } = await setup('https://example.invalid');
    const { completed, cookie } = await login();

    expect(completed.statusCode).toBe(200);
    expect(completed.body).toContain('<!doctype html>');
    expect(completed.headers['referrer-policy']).toBe('no-referrer');

    expect(completed.cookies[0]).toMatchObject({
      name: '__Host-jobbely_session',
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'Lax',
    });

    const current = await app.inject({
      method: 'GET',
      url: '/api/v1/account',
      headers: { cookie },
    });

    expect(current.statusCode).toBe(200);

    expect(current.json()).toMatchObject({
      user: { email: 'synthetic@example.invalid' },
      access: { capabilities: [] },
    });

    expect(current.json()).not.toHaveProperty('tokenHash');
    expect(current.body).not.toContain(cookie.split('=')[1]);
  });

  it('requires exact origin for mutations and rejects arbitrary client account/role fields', async () => {
    const { app, origin } = await setup();

    for (const headers of [{}, { origin: 'https://attacker.invalid' }]) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/auth/github/start',
            payload: {},
            headers,
          })
        ).statusCode,
      ).toBe(403);
    }

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/auth/github/start',
          payload: { userId: 'other', role: 'admin' },
          headers: { origin },
        })
      ).statusCode,
    ).toBe(400);
  });

  it('rejects forged/duplicate session cookies and protects logout with CSRF', async () => {
    const { app, login, origin } = await setup();
    const { cookie } = await login();
    const current = await app.inject({ url: '/api/v1/account', headers: { cookie } });

    expect(
      (await app.inject({ url: '/api/v1/account', headers: { cookie: 'jobbely_session=forged' } }))
        .statusCode,
    ).toBe(401);

    expect(
      (await app.inject({ url: '/api/v1/account', headers: { cookie: `${cookie}; ${cookie}` } }))
        .statusCode,
    ).toBe(401);

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/auth/logout',
          headers: { origin, cookie },
          payload: {},
        })
      ).statusCode,
    ).toBe(401);

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { origin, cookie, 'x-csrf-token': current.json().csrfToken },
      payload: {},
    });

    expect(logout.statusCode).toBe(200);
    expect(logout.cookies[0]?.maxAge).toBe(0);

    expect((await app.inject({ url: '/api/v1/account', headers: { cookie } })).statusCode).toBe(
      401,
    );
  });

  it('fails closed on revoked account state and provider configuration', async () => {
    const { app, login, accountRepository, origin } = await setup();
    const { cookie } = await login();

    for (const user of accountRepository.users.values()) {
      user.state = 'disabled';
    }

    expect((await app.inject({ url: '/api/v1/account', headers: { cookie } })).statusCode).toBe(
      401,
    );

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/auth/linkedin/start',
          headers: { origin },
          payload: {},
        })
      ).statusCode,
    ).toBe(503);

    expect((await app.inject('/api/v1/auth/providers')).json().items).toContainEqual({
      name: 'linkedin',
      available: false,
    });
  });

  it('bounds sign-in admission without leaking upstream errors', async () => {
    const { app, origin } = await setup();

    for (let count = 0; count < 10; count++) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/auth/github/start',
            headers: { origin },
            payload: {},
          })
        ).statusCode,
      ).toBe(200);
    }

    const limited = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/github/start',
      headers: { origin },
      payload: {},
    });

    expect(limited.statusCode).toBe(429);
    expect(limited.headers['cache-control']).toBe('no-store');
  });
});
