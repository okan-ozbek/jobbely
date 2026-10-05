import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AccountRepository, IdentityProvider } from '../../ports/accounts.js';
import type { MatchingAccessProvider, MatchingSubject } from '../../ports/account-access.js';
import { AccountAccessError, freeAccess } from '../../domain/accounts/access.js';
import type { SignInProvider } from '../../domain/accounts/identity.js';
import {
  sessionAbsoluteMs,
  sessionIdleMs,
  signInAttemptMs,
  sessionIsValid,
} from '../../domain/accounts/identity.js';

export function accountSecretHash(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function secret(): string {
  return randomBytes(32).toString('base64url');
}

function validSecret(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export class Accounts implements MatchingAccessProvider {
  constructor(
    private readonly repository: AccountRepository,
    private readonly providers: readonly IdentityProvider[],
    private readonly clock: () => Date = () => new Date(),
  ) {}

  availableProviders() {
    return (['github', 'linkedin'] as const).map((name) => ({
      name,
      available: this.providers.some((provider) => provider.name === name),
    }));
  }

  async start(name: SignInProvider, browserBinding?: string) {
    const provider = this.providers.find((item) => item.name === name);

    if (!provider) {
      throw new AccountAccessError('access_unavailable', 'Sign-in is currently unavailable.');
    }

    const state = secret();
    const browser = browserBinding && validSecret(browserBinding) ? browserBinding : secret();
    const verifier = secret();
    const nonce = secret();
    const now = this.clock();

    await this.repository.saveAttempt(
      {
        stateHash: accountSecretHash(state),
        browserHash: accountSecretHash(browser),
        provider: name,
        verifier,
        nonce,
        expiresAt: new Date(now.getTime() + signInAttemptMs).toISOString(),
      },
      now,
    );

    return {
      browser,
      authorizationUrl: provider.authorizationUrl({
        state,
        challenge: createHash('sha256').update(verifier).digest('base64url'),
        nonce,
      }),
    };
  }

  async finish(name: SignInProvider, state: string, code: string, browser: string) {
    if (!validSecret(state) || !validSecret(browser) || !code || code.length > 2_048) {
      throw new AccountAccessError('authentication_required', 'Restart sign-in and try again.');
    }

    const provider = this.providers.find((item) => item.name === name);
    const now = this.clock();

    const attempt = await this.repository.consumeAttempt(
      accountSecretHash(state),
      accountSecretHash(browser),
      name,
      now,
    );

    if (!provider || !attempt) {
      throw new AccountAccessError('authentication_required', 'Restart sign-in and try again.');
    }

    const identity = await provider.verify(code, attempt);

    if (
      identity.provider !== name ||
      identity.issuer !== (name === 'github' ? 'https://github.com' : 'https://www.linkedin.com') ||
      !identity.subject ||
      identity.subject.length > 200
    ) {
      throw new AccountAccessError('authentication_required', 'Could not verify this identity.');
    }

    const token = secret();
    const createdAt = this.clock();

    const session = await this.repository.createSession(
      identity,
      {
        tokenHash: accountSecretHash(token),
        csrfToken: secret(),
        idleExpiresAt: new Date(createdAt.getTime() + sessionIdleMs).toISOString(),
        absoluteExpiresAt: new Date(createdAt.getTime() + sessionAbsoluteMs).toISOString(),
        revokedAt: null,
      },
      createdAt,
    );

    return { token, session };
  }

  async current(token?: string) {
    if (token === undefined) {
      return null;
    }

    if (!validSecret(token)) {
      throw new AccountAccessError('authentication_required', 'Sign in again to continue.');
    }

    const now = this.clock();
    const session = await this.repository.readSession(accountSecretHash(token), now);

    if (!session || !sessionIsValid(session, now)) {
      throw new AccountAccessError('authentication_required', 'Sign in again to continue.');
    }

    return session;
  }

  async logout(token: string | undefined, csrf: string | undefined) {
    const session = await this.current(token);
    const expected = Buffer.from(session?.csrfToken ?? '');
    const actual = Buffer.from(csrf ?? '');

    if (
      !session ||
      !expected.length ||
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new AccountAccessError(
        'authentication_required',
        'Refresh your account and try again.',
      );
    }

    await this.repository.revokeSession(session.tokenHash, this.clock());
  }

  async resolve(subject: MatchingSubject) {
    if (subject.kind === 'guest') {
      return freeAccess();
    }

    const session = await this.current(subject.binding);

    // Billing projection is deliberately not enabled until Stripe reconciliation is implemented.
    return freeAccess(session!.user.id);
  }
}
