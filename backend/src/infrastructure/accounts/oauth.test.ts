import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { SignInAttempt } from '../../domain/accounts/identity.js';
import { OAuthIdentityProvider } from './oauth.js';

const configuration = {
  clientId: 'synthetic-client',
  clientSecret: 'synthetic-secret',
  callbackUrl: 'https://example.invalid/api/v1/auth/github/callback',
};

const attempt: SignInAttempt = {
  stateHash: 'state-hash',
  browserHash: 'browser-hash',
  provider: 'github',
  verifier: 'synthetic-verifier',
  nonce: 'synthetic-nonce',
  expiresAt: '2099-01-01T00:00:00Z',
};

const response = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

describe('GitHub sign-in adapter', () => {
  it('uses minimal identity permissions, exact callback and S256 PKCE', () => {
    const adapter = new OAuthIdentityProvider('github', configuration);

    const url = new URL(
      adapter.authorizationUrl({
        state: 'synthetic-state',
        challenge: 'challenge',
        nonce: 'nonce',
      }),
    );

    expect(url.origin).toBe('https://github.com');
    expect(url.searchParams.get('scope')).toBe('read:user user:email');
    expect(url.searchParams.get('redirect_uri')).toBe(configuration.callbackUrl);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('identifies by stable numeric ID and only accepts verified primary email', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ access_token: 'synthetic-token', token_type: 'bearer' }))
      .mockResolvedValueOnce(response({ id: 123, login: 'mutable-name' }))
      .mockResolvedValueOnce(
        response([{ email: 'synthetic@example.invalid', primary: true, verified: true }]),
      );

    const adapter = new OAuthIdentityProvider('github', configuration, fetcher);

    expect(await adapter.verify('synthetic-code', attempt)).toEqual({
      provider: 'github',
      issuer: 'https://github.com',
      subject: '123',
      email: 'synthetic@example.invalid',
    });

    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain('code_verifier=synthetic-verifier');
    expect(fetcher.mock.calls.every(([, options]) => options?.redirect === 'error')).toBe(true);
  });

  it('discards unverified email and never turns a mutable login into identity', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ access_token: 'synthetic-token', token_type: 'bearer' }))
      .mockResolvedValueOnce(response({ id: 123 }))
      .mockResolvedValueOnce(
        response([{ email: 'synthetic@example.invalid', primary: true, verified: false }]),
      );

    expect(
      (await new OAuthIdentityProvider('github', configuration, fetcher).verify('code', attempt))
        .email,
    ).toBeNull();
  });

  it('uses generic errors for provider failures, oversized payloads and malformed identities', async () => {
    for (const value of [
      new Response('secret upstream error', { status: 500 }),
      response({ access_token: 'x'.repeat(70_000), token_type: 'bearer' }),
      response({ token_type: 'bearer' }),
    ]) {
      const adapter = new OAuthIdentityProvider(
        'github',
        configuration,
        vi.fn<typeof fetch>().mockResolvedValue(value),
      );

      await expect(adapter.verify('private-code', attempt)).rejects.toThrow(
        'Sign-in failed. Please try again.',
      );
    }
  });
});

describe('LinkedIn OpenID Connect verification', () => {
  let keys: Awaited<ReturnType<typeof generateKeyPair>>;
  let jwks: ReturnType<typeof createLocalJWKSet>;

  beforeAll(async () => {
    keys = await generateKeyPair('RS256');

    jwks = createLocalJWKSet({
      keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'synthetic-key', alg: 'RS256' }],
    });
  });

  async function verify(
    change: Record<string, unknown> = {},
    userSubject = 'synthetic-subject',
    audience: string | string[] = configuration.clientId,
  ) {
    const token = await new SignJWT({ nonce: attempt.nonce, ...change })
      .setProtectedHeader({ alg: 'RS256', kid: 'synthetic-key' })
      .setIssuer('https://www.linkedin.com')
      .setAudience(audience)
      .setSubject('synthetic-subject')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(keys.privateKey);

    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ access_token: 'synthetic-token', token_type: 'Bearer', id_token: token }),
      )
      .mockResolvedValueOnce(response({ sub: userSubject }));

    return new OAuthIdentityProvider('linkedin', configuration, fetcher, jwks).verify('code', {
      ...attempt,
      provider: 'linkedin',
    });
  }

  it('validates a signed token and tolerates missing optional email', async () => {
    expect(await verify()).toEqual({
      provider: 'linkedin',
      issuer: 'https://www.linkedin.com',
      subject: 'synthetic-subject',
      email: null,
    });
  });

  it('rejects an incorrect nonce and mismatched userinfo subject', async () => {
    await expect(verify({ nonce: 'wrong' })).rejects.toThrow('Sign-in failed');
    await expect(verify({}, 'other-subject')).rejects.toThrow('Sign-in failed');
  });

  it('rejects an authorized-party claim for another client', async () => {
    await expect(verify({ azp: 'other-app' })).rejects.toThrow('Sign-in failed');

    const audience = [configuration.clientId, 'other-app'];

    await expect(verify({}, 'synthetic-subject', audience)).rejects.toThrow('Sign-in failed');

    await expect(
      verify({ azp: configuration.clientId }, 'synthetic-subject', audience),
    ).resolves.toMatchObject({ subject: 'synthetic-subject' });
  });

  it('rejects a token for another app, expired tokens and unverifiable signatures', async () => {
    for (const token of [
      await new SignJWT({ nonce: attempt.nonce })
        .setProtectedHeader({ alg: 'RS256', kid: 'synthetic-key' })
        .setIssuer('https://www.linkedin.com')
        .setAudience('other-app')
        .setSubject('synthetic-subject')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(keys.privateKey),
      await new SignJWT({ nonce: attempt.nonce })
        .setProtectedHeader({ alg: 'RS256', kid: 'synthetic-key' })
        .setIssuer('https://www.linkedin.com')
        .setAudience(configuration.clientId)
        .setSubject('synthetic-subject')
        .setIssuedAt()
        .setExpirationTime(1)
        .sign(keys.privateKey),
      'unsigned.payload.signature',
    ]) {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          response({ access_token: 'synthetic-token', token_type: 'Bearer', id_token: token }),
        );

      await expect(
        new OAuthIdentityProvider('linkedin', configuration, fetcher, jwks).verify('code', attempt),
      ).rejects.toThrow('Sign-in failed');
    }
  });
});
