import type {
  AccountSession,
  SignInAttempt,
  SignInProvider,
  VerifiedIdentity,
} from '../domain/accounts/identity.js';

export interface IdentityProvider {
  readonly name: SignInProvider;
  authorizationUrl(attempt: { state: string; challenge: string; nonce: string }): string;
  verify(code: string, attempt: SignInAttempt): Promise<VerifiedIdentity>;
}

export interface AccountRepository {
  saveAttempt(attempt: SignInAttempt, now: Date): Promise<void>;
  /** Atomically consume once, matching browser/provider/expiry before returning secrets. */
  consumeAttempt(
    stateHash: string,
    browserHash: string,
    provider: SignInProvider,
    now: Date,
  ): Promise<SignInAttempt | null>;
  createSession(
    identity: VerifiedIdentity,
    session: Omit<AccountSession, 'user'>,
    now: Date,
  ): Promise<AccountSession>;
  /** Recheck account/revocation/expiry and renew idle lifetime atomically, never absolute lifetime. */
  readSession(tokenHash: string, now: Date): Promise<AccountSession | null>;
  revokeSession(tokenHash: string, now: Date): Promise<void>;
  /** Recheck the active session atomically before removing this user's account records. */
  deleteAccount(userId: string, tokenHash: string, csrfToken: string, now: Date): Promise<boolean>;
  close(): Promise<void>;
}
