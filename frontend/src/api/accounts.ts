import createClient from 'openapi-fetch';
import type { paths } from './generated/schema.js';
import { ApiError } from './client.js';

export type Account =
  paths['/api/v1/account']['get']['responses'][200]['content']['application/json'];

export type SignInProvider = 'github' | 'linkedin';

const client = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  credentials: 'include',
});

export async function currentAccount(signal: AbortSignal): Promise<Account> {
  const result = await client.GET('/api/v1/account', { signal, cache: 'no-store' });

  if (!result.data) {
    throw new ApiError(result.error?.message ?? 'Could not load your account.', result.error?.code);
  }

  return result.data;
}

export async function signInProviders(signal: AbortSignal) {
  const result = await client.GET('/api/v1/auth/providers', { signal, cache: 'no-store' });

  if (!result.data) {
    throw new ApiError('Could not load sign-in options.');
  }

  return result.data;
}

function accountResult<T>(result: { data?: T; error?: { message: string; code: string } }): T {
  if (!result.data) {
    throw new ApiError(
      result.error?.message ?? 'Could not complete this account request.',
      result.error?.code,
    );
  }

  return result.data;
}

export async function requestEmailChange(
  body: { email: string; password: string },
  csrfToken: string,
  signal: AbortSignal,
) {
  return accountResult(
    await client.POST('/api/v1/account/email/change', {
      body,
      headers: { 'x-csrf-token': csrfToken },
      signal,
      cache: 'no-store',
    }),
  );
}

export async function confirmEmailChange(
  body: { challenge: string; code: string },
  csrfToken: string,
  signal: AbortSignal,
) {
  return accountResult(
    await client.POST('/api/v1/account/email/confirm', {
      body,
      headers: { 'x-csrf-token': csrfToken },
      signal,
      cache: 'no-store',
    }),
  );
}

export async function resendEmailChange(challenge: string, csrfToken: string, signal: AbortSignal) {
  return accountResult(
    await client.POST('/api/v1/account/email/resend', {
      body: { challenge },
      headers: { 'x-csrf-token': csrfToken },
      signal,
      cache: 'no-store',
    }),
  );
}

export type Plans = paths['/api/v1/plans']['get']['responses'][200]['content']['application/json'];

export type BillingPeriod = Plans['billingOptions'][number]['key'];

export async function listPlans(signal: AbortSignal) {
  return accountResult(await client.GET('/api/v1/plans', { signal, cache: 'no-store' }));
}

export async function createTestCheckout(
  period: BillingPeriod,
  requestId: string,
  csrfToken: string,
  signal: AbortSignal,
) {
  return accountResult(
    await client.POST('/api/v1/billing/checkout', {
      body: { period, requestId },
      headers: { 'x-csrf-token': csrfToken },
      signal,
      cache: 'no-store',
    }),
  );
}

export async function testCheckoutStatus(id: string, signal: AbortSignal) {
  return accountResult(
    await client.GET('/api/v1/billing/checkout/{id}', {
      params: { path: { id } },
      signal,
      cache: 'no-store',
    }),
  );
}

export async function registerPasswordAccount(
  body: { email: string; password: string },
  signal: AbortSignal,
) {
  return accountResult(
    await client.POST('/api/v1/auth/register', { body, signal, cache: 'no-store' }),
  );
}

export async function confirmPasswordAccount(
  body: { challenge: string; code: string },
  signal: AbortSignal,
) {
  return accountResult(
    await client.POST('/api/v1/auth/register/confirm', { body, signal, cache: 'no-store' }),
  );
}

export async function passwordSignIn(
  body: { email: string; password: string },
  signal: AbortSignal,
) {
  return accountResult(
    await client.POST('/api/v1/auth/password/login', { body, signal, cache: 'no-store' }),
  );
}

export async function requestPasswordReset(body: { email: string }, signal: AbortSignal) {
  return accountResult(
    await client.POST('/api/v1/auth/password/reset', { body, signal, cache: 'no-store' }),
  );
}

export async function completePasswordReset(
  body: { challenge: string; code: string; password: string },
  signal: AbortSignal,
) {
  return accountResult(
    await client.POST('/api/v1/auth/password/reset/confirm', { body, signal, cache: 'no-store' }),
  );
}

export async function resendEmailCode(challenge: string, signal: AbortSignal) {
  return accountResult(
    await client.POST('/api/v1/auth/email/resend', {
      body: { challenge },
      signal,
      cache: 'no-store',
    }),
  );
}

export async function startSignIn(provider: SignInProvider, signal: AbortSignal) {
  const result = await client.POST('/api/v1/auth/{provider}/start', {
    params: { path: { provider } },
    body: {},
    signal,
    cache: 'no-store',
  });

  if (!result.data) {
    throw new ApiError(result.error?.message ?? 'Could not start sign-in.');
  }

  return result.data.authorizationUrl;
}

export async function signOut(csrfToken: string, signal: AbortSignal) {
  const result = await client.POST('/api/v1/auth/logout', {
    headers: { 'x-csrf-token': csrfToken },
    body: {},
    signal,
    cache: 'no-store',
  });

  if (!result.data) {
    throw new ApiError(result.error?.message ?? 'Could not sign out.', result.error?.code);
  }
}

export async function deleteAccount(csrfToken: string, signal: AbortSignal) {
  return accountResult(
    await client.POST('/api/v1/account/delete', {
      headers: { 'x-csrf-token': csrfToken },
      body: { confirm: true },
      signal,
      cache: 'no-store',
    }),
  );
}
