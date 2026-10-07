import { createHmac, randomBytes, randomInt } from 'node:crypto';
import type {
  PasswordAccountRepository,
  PasswordHasher,
  AccountEmailCipher,
} from '../../ports/password-accounts.js';
import type { EmailCodePurpose, NewAccountSession } from '../../domain/accounts/password.js';
import {
  emailCodeLifetimeMs,
  PasswordAccountError,
  validNewPassword,
} from '../../domain/accounts/password.js';
import { sessionAbsoluteMs, sessionIdleMs } from '../../domain/accounts/identity.js';
import { accountSecretHash } from './accounts.js';

const opaque = () => randomBytes(32).toString('base64url');

const validOpaque = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);

const newCode = () => String(randomInt(1_000_000)).padStart(6, '0');

export class PasswordAccounts {
  constructor(
    private readonly repository: PasswordAccountRepository,
    private readonly hasher: PasswordHasher,
    private readonly cipher: AccountEmailCipher,
    private readonly codeSecret: string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private digest(...values: string[]) {
    return createHmac('sha256', this.codeSecret).update(JSON.stringify(values)).digest('hex');
  }

  private email(input: string) {
    const email = input.trim().toLowerCase();

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new PasswordAccountError('invalid_input', 'Enter a valid email address.');
    }

    return email;
  }

  private password(input: string) {
    const password = input.normalize('NFC');

    if (!validNewPassword(password)) {
      throw new PasswordAccountError(
        'invalid_input',
        'Password is not valid. Use 8–128 characters, including a number and a symbol.',
      );
    }

    return password;
  }

  private async admit(action: string, ip: string, email?: string) {
    if (
      !(await this.repository.admit(
        [
          {
            key: this.digest('ip', action, ip),
            maximum: action === 'login' ? 20 : action === 'verify' ? 30 : 10,
          },
          ...(email
            ? [{ key: this.digest('email', action, email), maximum: action === 'login' ? 10 : 3 }]
            : []),
        ],
        this.clock(),
      ))
    ) {
      throw new PasswordAccountError('rate_limited', 'Too many attempts. Try again in 15 minutes.');
    }
  }

  private session(now: Date): { token: string; session: NewAccountSession } {
    const token = opaque();

    return {
      token,
      session: {
        tokenHash: accountSecretHash(token),
        csrfToken: opaque(),
        revokedAt: null,
        idleExpiresAt: new Date(now.getTime() + sessionIdleMs).toISOString(),
        absoluteExpiresAt: new Date(now.getTime() + sessionAbsoluteMs).toISOString(),
      },
    };
  }

  async requestCode(
    purpose: EmailCodePurpose,
    input: {
      email: string;
      password?: string;
    },
    ip: string,
    browserBinding?: string,
  ) {
    const email = this.email(input.email);

    await this.admit(purpose, ip, email);

    const passwordHash =
      purpose === 'register' ? await this.hasher.hash(this.password(input.password ?? '')) : null;

    const token = opaque();
    const browser = browserBinding && validOpaque(browserBinding) ? browserBinding : opaque();
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + emailCodeLifetimeMs).toISOString();
    const code = newCode();
    const tokenHash = accountSecretHash(token);

    await this.repository.createChallenge(
      {
        tokenHash,
        browserHash: accountSecretHash(browser),
        email,
        purpose,
        passwordHash,
        username: null,
        codeHash: this.digest('code', tokenHash, purpose, code),
        expiresAt,
        createdAt: now.toISOString(),
        consumedAt: null,
        attempts: 0,
        sends: 1,
      },
      this.cipher.seal({ to: email, code, purpose, expiresAt }),
      now,
    );

    return { challenge: token, browser };
  }

  async resend(challenge: string, browser: string, ip: string) {
    if (!validOpaque(challenge) || !validOpaque(browser)) {
      throw new PasswordAccountError('invalid_code', 'Request a new code and try again.');
    }

    await this.admit('verify', ip);

    const tokenHash = accountSecretHash(challenge);
    const browserHash = accountSecretHash(browser);
    const now = this.clock();
    const pending = await this.repository.readChallenge(tokenHash, browserHash, now);

    if (!pending) {
      throw new PasswordAccountError('invalid_code', 'Request a new code and try again.');
    }

    await this.admit(pending.purpose, ip, pending.email);

    const code = newCode();

    const sealed = this.cipher.seal({
      to: pending.email,
      code,
      purpose: pending.purpose,
      expiresAt: pending.expiresAt,
    });

    if (
      !(await this.repository.resendChallenge(
        tokenHash,
        browserHash,
        this.digest('code', tokenHash, pending.purpose, code),
        sealed,
        now,
      ))
    ) {
      throw new PasswordAccountError('invalid_code', 'Request a new code and try again.');
    }
  }

  private async codeInput(
    challenge: string,
    browser: string,
    code: string,
    purpose: EmailCodePurpose,
    ip: string,
  ) {
    await this.admit('verify', ip);

    if (!validOpaque(challenge) || !validOpaque(browser) || !/^\d{6}$/.test(code)) {
      throw new PasswordAccountError(
        'invalid_code',
        'Invalid or expired code. Request a new code if needed.',
      );
    }

    const tokenHash = accountSecretHash(challenge);

    return {
      tokenHash,
      browserHash: accountSecretHash(browser),
      codeHash: this.digest('code', tokenHash, purpose, code),
    };
  }

  async confirm(challenge: string, code: string, browser: string, ip: string) {
    const input = await this.codeInput(challenge, browser, code, 'register', ip);
    const now = this.clock();
    const issued = this.session(now);

    const session = await this.repository.confirmRegistration(
      input.tokenHash,
      input.browserHash,
      input.codeHash,
      issued.session,
      now,
    );

    if (!session) {
      throw new PasswordAccountError(
        'invalid_code',
        'Could not confirm this account. Request a new code or sign in.',
      );
    }

    return { token: issued.token, session };
  }

  async reset(challenge: string, code: string, password: string, browser: string, ip: string) {
    const input = await this.codeInput(challenge, browser, code, 'reset', ip);
    const passwordHash = await this.hasher.hash(this.password(password));

    if (
      !(await this.repository.resetPassword(
        input.tokenHash,
        input.browserHash,
        input.codeHash,
        passwordHash,
        this.clock(),
      ))
    ) {
      throw new PasswordAccountError(
        'invalid_code',
        'Invalid or expired code. Request a new code if needed.',
      );
    }
  }

  async login(input: { email: string; password: string }, ip: string) {
    const email = this.email(input.email);

    await this.admit('login', ip, email);

    const credential = await this.repository.credential(email);

    const correct = await this.hasher.verify(
      input.password.normalize('NFC'),
      credential?.passwordHash ?? null,
    );

    if (!correct || !credential || credential.state !== 'active') {
      throw new PasswordAccountError(
        'invalid_credentials',
        'Email or password is incorrect. Confirm your email before signing in.',
      );
    }

    const now = this.clock();
    const issued = this.session(now);

    const session = await this.repository.createPasswordSession(
      email,
      credential.passwordHash,
      issued.session,
      now,
    );

    if (!session) {
      throw new PasswordAccountError('invalid_credentials', 'Email or password is incorrect.');
    }

    return { token: issued.token, session };
  }
}
