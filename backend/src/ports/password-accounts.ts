import type { AccountSession } from '../domain/accounts/identity.js';
import type {
  EmailChallenge,
  EmailCodePurpose,
  NewAccountSession,
} from '../domain/accounts/password.js';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string | null): Promise<boolean>;
}

export interface AccountEmail {
  to: string;
  code: string;
  purpose: EmailCodePurpose;
  expiresAt: string;
}

export interface AccountEmailCipher {
  seal(message: AccountEmail): string;
}

export interface PasswordAccountRepository {
  admit(buckets: { key: string; maximum: number }[], now: Date): Promise<boolean>;
  createChallenge(challenge: EmailChallenge, sealedEmail: string, now: Date): Promise<void>;
  readChallenge(tokenHash: string, browserHash: string, now: Date): Promise<EmailChallenge | null>;
  resendChallenge(
    tokenHash: string,
    browserHash: string,
    codeHash: string,
    sealedEmail: string,
    now: Date,
  ): Promise<boolean>;
  confirmRegistration(
    tokenHash: string,
    browserHash: string,
    codeHash: string,
    session: NewAccountSession,
    now: Date,
  ): Promise<AccountSession | 'account_exists' | null>;
  resetPassword(
    tokenHash: string,
    browserHash: string,
    codeHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<boolean>;
  createEmailChange(
    challenge: EmailChallenge,
    sealedEmail: string,
    session: AccountSession,
    now: Date,
  ): Promise<boolean>;
  confirmEmailChange(
    tokenHash: string,
    browserHash: string,
    codeHash: string,
    authorization: AccountSession,
    session: NewAccountSession,
    now: Date,
  ): Promise<AccountSession | null>;
  credential(
    email: string,
  ): Promise<{ userId: string; passwordHash: string; state: string } | null>;
  createPasswordSession(
    email: string,
    expectedHash: string,
    session: NewAccountSession,
    now: Date,
  ): Promise<AccountSession | null>;
  close(): Promise<void>;
}
