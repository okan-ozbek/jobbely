import { randomUUID } from 'node:crypto';
import type { AccountRepository } from '../../ports/accounts.js';
import type {
  AccountSession,
  AccountUser,
  SignInAttempt,
  SignInProvider,
  VerifiedIdentity,
} from '../../domain/accounts/identity.js';
import {
  accountDeletionSignInMs,
  sessionIdleMs,
  sessionIsValid,
} from '../../domain/accounts/identity.js';
import { AccountAccessError } from '../../domain/accounts/access.js';

/** Test-only adapter; never a persistent-mode fallback. */
export class MemoryAccounts implements AccountRepository {
  readonly users = new Map<string, AccountUser>();
  readonly sessions = new Map<string, AccountSession>();
  private readonly identities = new Map<string, string>();
  private readonly attempts = new Map<string, SignInAttempt>();
  private readonly signedInAt = new Map<string, number>();

  async saveAttempt(attempt: SignInAttempt, now: Date) {
    for (const [key, value] of this.attempts) {
      if (Date.parse(value.expiresAt) <= now.getTime()) {
        this.attempts.delete(key);
      }
    }

    this.attempts.set(attempt.stateHash, structuredClone(attempt));
  }

  async consumeAttempt(
    stateHash: string,
    browserHash: string,
    provider: SignInProvider,
    now: Date,
  ) {
    const attempt = this.attempts.get(stateHash);

    if (
      !attempt ||
      attempt.browserHash !== browserHash ||
      attempt.provider !== provider ||
      Date.parse(attempt.expiresAt) <= now.getTime()
    ) {
      return null;
    }

    this.attempts.delete(stateHash);

    return structuredClone(attempt);
  }

  async createSession(identity: VerifiedIdentity, input: Omit<AccountSession, 'user'>, now: Date) {
    const key = JSON.stringify([identity.issuer, identity.subject]);
    const existingId = this.identities.get(key);

    const user = existingId
      ? this.users.get(existingId)!
      : {
          id: randomUUID(),
          state: 'active' as const,
          email: identity.email,
        };

    if (user.state !== 'active') {
      throw new AccountAccessError('authentication_required', 'Sign in to an active account.');
    }

    user.email = identity.email;
    this.users.set(user.id, user);
    this.identities.set(key, user.id);

    const session = { ...input, user };

    this.sessions.set(session.tokenHash, session);
    this.signedInAt.set(session.tokenHash, now.getTime());

    return structuredClone(session);
  }

  async readSession(tokenHash: string, now: Date) {
    const session = this.sessions.get(tokenHash);

    if (!session || !sessionIsValid(session, now)) {
      return null;
    }

    session.idleExpiresAt = new Date(
      Math.min(now.getTime() + sessionIdleMs, Date.parse(session.absoluteExpiresAt)),
    ).toISOString();

    return structuredClone(session);
  }

  async revokeSession(tokenHash: string, now: Date) {
    const session = this.sessions.get(tokenHash);

    if (session) {
      session.revokedAt = now.toISOString();
    }
  }

  async close() {}

  async deleteAccount(userId: string, tokenHash: string, csrfToken: string, now: Date) {
    const session = this.sessions.get(tokenHash);

    if (
      !session ||
      session.user.id !== userId ||
      session.csrfToken !== csrfToken ||
      !sessionIsValid(session, now)
    ) {
      return false;
    }

    if ((this.signedInAt.get(tokenHash) ?? 0) <= now.getTime() - accountDeletionSignInMs) {
      throw new AccountAccessError(
        'authentication_required',
        'Sign out and sign in again before deleting your account.',
      );
    }

    for (const [key, value] of this.sessions) {
      if (value.user.id === userId) {
        this.sessions.delete(key);
        this.signedInAt.delete(key);
      }
    }

    for (const [key, value] of this.identities) {
      if (value === userId) {
        this.identities.delete(key);
      }
    }

    this.users.delete(userId);

    return true;
  }
}
