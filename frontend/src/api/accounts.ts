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

  return result.data.items;
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
