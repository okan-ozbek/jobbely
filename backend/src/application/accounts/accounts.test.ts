import { describe, expect, it, vi } from 'vitest';
import { Accounts, accountSecretHash } from './accounts.js';
import { MemoryAccounts } from '../../infrastructure/storage/accounts-memory.js';
import type { IdentityProvider } from '../../ports/accounts.js';

function setup() {
  let now = new Date('2026-10-05T12:00:00Z');
  const repository = new MemoryAccounts();

  const provider: IdentityProvider = {
    name: 'github',
    authorizationUrl: ({ state, challenge }) =>
      `https://github.com/login/oauth/authorize?state=${state}&code_challenge=${challenge}`,
    verify: vi.fn(async () => ({
      provider: 'github',
      issuer: 'https://github.com',
      subject: '123',
      email: 'synthetic@example.invalid',
    })),
  };

  const service = new Accounts(repository, [provider], () => now);

  async function signIn() {
    const start = await service.start('github');
    const state = new URL(start.authorizationUrl).searchParams.get('state')!;
    const result = await service.finish('github', state, 'synthetic-code', start.browser);

    return { ...result, start, state };
  }

  return {
    service,
    repository,
    provider,
    signIn,
    setTime: (value: string) => {
      now = new Date(value);
    },
  };
}

describe('application-owned sign-in and sessions', () => {
  it('registers by provider subject, stores only the session hash and rotates the secret on login', async () => {
    const { signIn, repository, service } = setup();
    const first = await signIn();
    const second = await signIn();

    expect(second.session.user.id).toBe(first.session.user.id);
    expect(second.token).not.toBe(first.token);
    expect(repository.users.size).toBe(1);
    expect(repository.sessions.has(first.token)).toBe(false);
    expect(repository.sessions.has(accountSecretHash(first.token))).toBe(true);
    expect(await service.current(first.token)).toMatchObject({ user: first.session.user });

    expect(await service.resolve({ kind: 'account', binding: first.token })).toMatchObject({
      capabilities: [],
    });
  });

  it('rejects a changed state, browser, provider and reused callback before invoking the identity adapter', async () => {
    const { service, provider } = setup();
    const start = await service.start('github');
    const state = new URL(start.authorizationUrl).searchParams.get('state')!;

    await expect(service.finish('github', 'x'.repeat(43), 'code', start.browser)).rejects.toThrow(
      'Restart',
    );

    await expect(service.finish('github', state, 'code', 'x'.repeat(43))).rejects.toThrow(
      'Restart',
    );

    await expect(service.finish('linkedin', state, 'code', start.browser)).rejects.toThrow(
      'Restart',
    );

    expect(provider.verify).not.toHaveBeenCalled();
    await service.finish('github', state, 'code', start.browser);
    await expect(service.finish('github', state, 'code', start.browser)).rejects.toThrow('Restart');
    expect(provider.verify).toHaveBeenCalledTimes(1);
  });

  it('expires sign-in attempts and never extends sessions beyond their absolute lifetime', async () => {
    const { service, signIn, setTime } = setup();
    const result = await signIn();
    const start = await service.start('github');
    const state = new URL(start.authorizationUrl).searchParams.get('state')!;

    setTime('2026-10-05T12:10:00Z');
    await expect(service.finish('github', state, 'code', start.browser)).rejects.toThrow('Restart');

    for (const day of ['11', '17', '23', '29']) {
      setTime(`2026-10-${day}T12:00:00Z`);
      await service.current(result.token);
    }

    setTime('2026-11-03T12:00:00Z');

    expect((await service.current(result.token))?.idleExpiresAt).toBe(
      result.session.absoluteExpiresAt,
    );

    setTime(result.session.absoluteExpiresAt);
    await expect(service.current(result.token)).rejects.toThrow('Sign in again');
  });

  it('does not revive idle expiry or disabled accounts and requires CSRF before logout', async () => {
    const { service, repository, signIn, setTime } = setup();
    const first = await signIn();

    await expect(service.logout(first.token, 'wrong')).rejects.toThrow('Refresh');
    expect(await service.current(first.token)).not.toBeNull();
    await service.logout(first.token, first.session.csrfToken);
    await expect(service.current(first.token)).rejects.toThrow('Sign in again');

    const second = await signIn();

    repository.users.get(second.session.user.id)!.state = 'disabled';
    await expect(service.current(second.token)).rejects.toThrow('Sign in again');
    await expect(signIn()).rejects.toThrow('active account');
    repository.users.get(second.session.user.id)!.state = 'active';
    setTime('2026-10-12T12:00:00Z');
    await expect(service.current(second.token)).rejects.toThrow('Sign in again');
  });

  it('distinguishes absent sessions from forged ones and keeps unsupported providers unavailable', async () => {
    const { service } = setup();

    expect(await service.current()).toBeNull();
    await expect(service.current('forged')).rejects.toThrow('Sign in again');
    await expect(service.current('x'.repeat(43))).rejects.toThrow('Sign in again');
    await expect(service.start('linkedin')).rejects.toThrow('unavailable');
  });

  it('never merges identities that happen to have the same email', async () => {
    const { signIn, provider, repository } = setup();

    await signIn();

    vi.mocked(provider.verify).mockResolvedValue({
      provider: 'github',
      issuer: 'https://github.com',
      subject: '456',
      email: 'synthetic@example.invalid',
    });

    await signIn();

    expect(repository.users.size).toBe(2);
  });
});
