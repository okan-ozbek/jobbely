import type { AccountSession } from './identity.js';

export type EmailCodePurpose = 'register' | 'reset' | 'change-email';

export const emailCodeLifetimeMs = 10 * 60_000;

export const emailCodeAttempts = 5;

export const emailCodeSends = 3;

export function validNewPassword(input: string): boolean {
  const password = input.normalize('NFC');
  const length = [...password].length;

  return length >= 8 && length <= 128 && /[0-9]/.test(password) && /[\p{P}\p{S}]/u.test(password);
}

export interface EmailChallenge {
  tokenHash: string;
  browserHash: string;
  email: string;
  purpose: EmailCodePurpose;
  codeHash: string;
  passwordHash: string | null;
  username: string | null;
  userId?: string | null;
  previousEmail?: string | null;
  attempts: number;
  sends: number;
  expiresAt: string;
  createdAt: string;
  consumedAt: string | null;
}

export type NewAccountSession = Omit<AccountSession, 'user'>;

export function usableEmailChallenge(challenge: EmailChallenge, now: Date): boolean {
  return (
    !challenge.consumedAt &&
    challenge.attempts < emailCodeAttempts &&
    Date.parse(challenge.expiresAt) > now.getTime()
  );
}

export class PasswordAccountError extends Error {
  constructor(
    public readonly code:
      | 'invalid_credentials'
      | 'invalid_code'
      | 'account_exists'
      | 'invalid_input'
      | 'rate_limited'
      | 'access_unavailable',
    message: string,
  ) {
    super(message);
  }
}
