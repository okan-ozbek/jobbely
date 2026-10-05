import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordHasher } from '../../ports/password-accounts.js';
import { PasswordAccountError } from '../../domain/accounts/password.js';

const prefix = 'scrypt$131072$8$1';
const dummyHash = `${prefix}$${'0'.repeat(32)}$${'0'.repeat(128)}`;
let hashing = 0;

/** Stable Node crypto; OWASP's scrypt minimum, with bounded process memory. */
export class ScryptPasswords implements PasswordHasher {
  private async derive(password: string, salt: Buffer): Promise<Buffer> {
    if (hashing >= 2) {
      throw new PasswordAccountError('access_unavailable', 'Sign-in is busy. Please try again.');
    }

    hashing++;

    try {
      return await new Promise<Buffer>((resolve, reject) => {
        scrypt(
          password,
          salt,
          64,
          { N: 131_072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 },
          (error, key) => (error ? reject(error) : resolve(key)),
        );
      });
    } finally {
      hashing--;
    }
  }

  async hash(password: string) {
    const salt = randomBytes(16);

    return `${prefix}$${salt.toString('hex')}$${(await this.derive(password, salt)).toString('hex')}`;
  }

  async verify(password: string, hash: string | null) {
    const valid =
      typeof hash === 'string' && /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash);

    const parts = (valid ? hash : dummyHash).split('$');
    const derived = await this.derive(password, Buffer.from(parts[4]!, 'hex'));

    return timingSafeEqual(derived, Buffer.from(parts[5]!, 'hex')) && valid;
  }
}
