import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { AccountEmail, AccountEmailCipher } from '../../ports/password-accounts.js';

const messageSchema = z
  .object({
    to: z.email().max(254),
    code: z.string().regex(/^\d{6}$/),
    purpose: z.enum(['register', 'reset']),
    expiresAt: z.iso.datetime(),
  })
  .strict();

export class EncryptedAccountEmail implements AccountEmailCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    if (secret.length < 32) {
      throw new Error('Account email secret requires 32+ random characters');
    }

    this.key = createHmac('sha256', secret).update('jobbely-account-mail-v1').digest();
  }

  seal(message: AccountEmail) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);

    cipher.setAAD(Buffer.from('account-mail-v1'));

    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(messageSchema.parse(message))),
      cipher.final(),
    ]);

    return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
  }

  open(sealed: string): AccountEmail {
    if (sealed.length > 4_096) {
      throw new Error('Invalid account email payload');
    }

    const [version, iv, tag, encrypted, extra] = sealed.split('.');

    if (version !== 'v1' || !iv || !tag || !encrypted || extra !== undefined) {
      throw new Error('Invalid account email payload');
    }

    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));

    decipher.setAAD(Buffer.from('account-mail-v1'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));

    const decoded = Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]);

    return messageSchema.parse(JSON.parse(decoded.toString('utf8')));
  }
}
