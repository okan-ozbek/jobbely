import { describe, expect, it } from 'vitest';
import { renderAccountEmail } from './account-email-template.js';

describe('account email presentation', () => {
  it('keeps the leading-zero code and expiry in both email formats without remote content', () => {
    const email = renderAccountEmail({
      to: 'synthetic@example.invalid',
      code: '012345',
      purpose: 'register',
      expiresAt: '2099-01-01T00:00:00Z',
    });

    expect(email.subject).toBe('Confirm your email — Jobbely');
    expect(email.html).toContain('012345');
    expect(email.text).toContain('012345');
    expect(email.html).toContain('after your first request');
    expect(email.text).toContain('after your first request');
    expect(email.html).not.toMatch(/<script|<img|https?:\/\//);
    expect(email.html).not.toContain('synthetic@example.invalid');
  });

  it('uses password recovery copy and escapes any dynamic markup', () => {
    const email = renderAccountEmail({
      to: 'synthetic@example.invalid',
      code: '<script>"&\'</script>',
      purpose: 'reset',
      expiresAt: '2099-01-01T00:00:00Z',
    });

    expect(email.subject).toBe('Reset your password — Jobbely');
    expect(email.html).toContain('set a new password');
    expect(email.text).toContain('set a new password');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;');
  });
});
