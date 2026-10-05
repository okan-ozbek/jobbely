import { describe, expect, it } from 'vitest';
import { ScryptPasswords } from './password-hasher.js';
import { EncryptedAccountEmail } from './email-cipher.js';

describe('password hashing and queued email confidentiality', () => {
  it('uses independently salted, versioned hashes and checks absent/malformed credentials at the same work factor', async () => {
    const hasher = new ScryptPasswords();
    const password = 'synthetic-long-passphrase';
    const first = await hasher.hash(password);
    const second = await hasher.hash(password);

    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(first).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(await hasher.verify(password, first)).toBe(true);
    expect(await hasher.verify('incorrect-password', first)).toBe(false);
    expect(await hasher.verify(password, null)).toBe(false);
    expect(await hasher.verify(password, 'malformed')).toBe(false);
  }, 10_000);

  it('encrypts/authenticates queue payloads and rejects tampering or a different key', () => {
    const cipher = new EncryptedAccountEmail('synthetic-only-secret-with-32-characters');

    const message = {
      to: 'synthetic@example.invalid',
      code: '012345',
      purpose: 'register' as const,
      expiresAt: '2099-01-01T00:00:00.000Z',
    };

    const sealed = cipher.seal(message);

    expect(sealed).not.toContain(message.to);
    expect(sealed).not.toContain(message.code);
    expect(cipher.open(sealed)).toEqual(message);
    expect(() => cipher.open(sealed.replace('v1.', 'v2.'))).toThrow();

    expect(() =>
      new EncryptedAccountEmail('another-synthetic-secret-with-32-chars').open(sealed),
    ).toThrow();

    const pieces = sealed.split('.');

    pieces[3] = `${pieces[3]![0] === 'A' ? 'B' : 'A'}${pieces[3]!.slice(1)}`;
    expect(() => cipher.open(pieces.join('.'))).toThrow();
  });
});
