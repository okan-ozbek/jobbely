import type { MatchingAccess } from '../domain/accounts/access.js';

/** Supplied only by a server session adapter, never taken from a request body. */
export type MatchingSubject =
  { kind: 'guest'; binding: string } | { kind: 'account'; binding: string };

export interface MatchingAccessProvider {
  /** Verify session validity and current entitlement on every call; fail closed on errors. */
  resolve(subject: MatchingSubject): Promise<MatchingAccess>;
}
