import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import type { IdentityProvider } from '../../ports/accounts.js';
import type { SignInAttempt, SignInProvider } from '../../domain/accounts/identity.js';
import { AccountAccessError } from '../../domain/accounts/access.js';

interface OAuthConfiguration {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

const endpoints = {
  github: {
    authorization: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
  },
  linkedin: {
    authorization: 'https://www.linkedin.com/oauth/v2/authorization',
    token: 'https://www.linkedin.com/oauth/v2/accessToken',
    scope: 'openid profile email',
  },
};

const tokenSchema = z.object({
  access_token: z.string().min(1).max(8_192),
  token_type: z.string().refine((value) => value.toLowerCase() === 'bearer'),
  id_token: z.string().max(16_384).optional(),
});

const linkedInKeys = createRemoteJWKSet(new URL('https://www.linkedin.com/oauth/openid/jwks'), {
  timeoutDuration: 10_000,
});

export class OAuthIdentityProvider implements IdentityProvider {
  constructor(
    public readonly name: SignInProvider,
    private readonly configuration: OAuthConfiguration,
    private readonly fetcher: typeof fetch = fetch,
    private readonly linkedinKeys: JWTVerifyGetKey = linkedInKeys,
  ) {}

  authorizationUrl(attempt: { state: string; challenge: string; nonce: string }): string {
    const url = new URL(endpoints[this.name].authorization);

    url.search = new URLSearchParams({
      client_id: this.configuration.clientId,
      redirect_uri: this.configuration.callbackUrl,
      response_type: 'code',
      scope: endpoints[this.name].scope,
      state: attempt.state,
      ...(this.name === 'github'
        ? { code_challenge: attempt.challenge, code_challenge_method: 'S256' }
        : { nonce: attempt.nonce }),
    }).toString();

    return url.toString();
  }

  private async json(url: string, options: RequestInit): Promise<unknown> {
    const response = await this.fetcher(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok || !response.body) {
      throw new Error('Identity request failed');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    try {
      for (;;) {
        const chunk = await reader.read();

        if (chunk.done) {
          break;
        }

        size += chunk.value.byteLength;

        if (size > 64 * 1024) {
          throw new Error('Identity response exceeds limit');
        }

        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel();
    }

    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  }

  async verify(code: string, attempt: SignInAttempt) {
    try {
      const token = tokenSchema.parse(
        await this.json(endpoints[this.name].token, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: this.configuration.clientId,
            client_secret: this.configuration.clientSecret,
            redirect_uri: this.configuration.callbackUrl,
            grant_type: 'authorization_code',
            code,
            ...(this.name === 'github' ? { code_verifier: attempt.verifier } : {}),
          }),
        }),
      );

      if (this.name === 'github') {
        const headers = {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token.access_token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Jobbely-sign-in',
        };

        const user = z
          .object({ id: z.number().int().positive().safe() })
          .parse(await this.json('https://api.github.com/user', { headers }));

        const emails = z
          .array(
            z.object({
              email: z.email().max(320),
              primary: z.boolean(),
              verified: z.boolean(),
            }),
          )
          .max(100)
          .parse(await this.json('https://api.github.com/user/emails?per_page=100', { headers }));

        return {
          provider: this.name,
          issuer: 'https://github.com',
          subject: String(user.id),
          email: emails.find((email) => email.primary && email.verified)?.email ?? null,
        };
      }

      if (!token.id_token) {
        throw new Error('Missing identity token');
      }

      const { payload } = await jwtVerify(token.id_token, this.linkedinKeys, {
        issuer: 'https://www.linkedin.com',
        audience: this.configuration.clientId,
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
        maxTokenAge: '10m',
      });

      if (
        payload.nonce !== attempt.nonce ||
        !payload.sub ||
        payload.sub.length > 200 ||
        (Array.isArray(payload.aud) &&
          payload.aud.length > 1 &&
          payload.azp !== this.configuration.clientId) ||
        (payload.azp !== undefined && payload.azp !== this.configuration.clientId)
      ) {
        throw new Error('Invalid identity binding');
      }

      const user = z
        .object({
          sub: z.string().min(1).max(200),
          email: z.email().max(320).optional(),
          email_verified: z.boolean().optional(),
        })
        .parse(
          await this.json('https://api.linkedin.com/v2/userinfo', {
            headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
          }),
        );

      if (user.sub !== payload.sub) {
        throw new Error('Identity mismatch');
      }

      return {
        provider: this.name,
        issuer: 'https://www.linkedin.com',
        subject: payload.sub,
        email: user.email_verified ? (user.email ?? null) : null,
      };
    } catch {
      // Provider errors can contain tokens, codes and email; never forward or log them.
      throw new AccountAccessError('authentication_required', 'Sign-in failed. Please try again.');
    }
  }
}
