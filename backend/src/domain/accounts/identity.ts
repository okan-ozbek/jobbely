export type SignInProvider = 'github' | 'linkedin';

export interface VerifiedIdentity {
  provider: SignInProvider;
  issuer: string;
  subject: string;
  email: string | null;
}

export interface AccountUser {
  id: string;
  state: 'active' | 'disabled' | 'deleted';
  email: string | null;
  username?: string | null;
}

export interface AccountSession {
  tokenHash: string;
  csrfToken: string;
  user: AccountUser;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  revokedAt: string | null;
}

export interface SignInAttempt {
  stateHash: string;
  browserHash: string;
  provider: SignInProvider;
  verifier: string;
  nonce: string;
  expiresAt: string;
}

export const sessionIdleMs = 7 * 24 * 60 * 60_000;

export const sessionAbsoluteMs = 30 * 24 * 60 * 60_000;

export const signInAttemptMs = 10 * 60_000;

export const accountDeletionSignInMs = 10 * 60_000;

export function sessionIsValid(session: AccountSession, now: Date): boolean {
  const idle = Date.parse(session.idleExpiresAt);
  const absolute = Date.parse(session.absoluteExpiresAt);

  return (
    session.user.state === 'active' &&
    session.revokedAt === null &&
    Number.isFinite(now.getTime()) &&
    Number.isFinite(idle) &&
    Number.isFinite(absolute) &&
    now.getTime() < idle &&
    now.getTime() < absolute
  );
}
