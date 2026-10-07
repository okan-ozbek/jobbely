import type { AccountEmail } from '../../ports/password-accounts.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character] ?? character;
  });
}

export function renderAccountEmail(message: AccountEmail) {
  const registration = message.purpose === 'register';
  const action = registration ? 'Confirm your email' : 'Reset your password';

  const introduction = registration
    ? 'Welcome to Jobbely. You’re one small step away from your new account.'
    : 'Let’s get you back into your Jobbely account.';

  const instruction = registration
    ? 'Enter this code in Jobbely to confirm your email address.'
    : 'Enter this code in Jobbely to set a new password.';

  const expiry = 'The code expires ten minutes after your first request and can be used once.';

  const safety =
    'Never share this code. If you did not request this, you can safely ignore this email.';

  return {
    subject: `${action} — Jobbely`,
    text: `${action}\n\n${introduction}\n\n${instruction}\n\n${message.code}\n\n${expiry}\n\n${safety}`,
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${action} — Jobbely</title></head>
<body style="margin:0;padding:0;background-color:#f0efff;color:#25243a;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${instruction}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0efff;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding:0 0 24px;font-size:30px;font-weight:700;letter-spacing:-1px;">jobbely<span style="color:#7064ec;">.</span></td></tr>
        <tr><td style="padding:32px 24px;background-color:#fafaff;border:1px solid #dddaf7;border-radius:24px;">
          <p style="margin:0 0 12px;color:#7064ec;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${registration ? 'Email verification' : 'Password recovery'}</p>
          <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;letter-spacing:-0.6px;">${action}</h1>
          <p style="margin:0 0 20px;color:#626079;font-size:15px;line-height:1.6;">${introduction}</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${instruction}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:22px 8px;background-color:#efedff;border:1px solid #d5d0fc;border-radius:16px;color:#5145c4;font-family:Consolas,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:7px;">${escapeHtml(message.code)}</td></tr></table>
          <p style="margin:16px 0 0;color:#626079;font-size:13px;line-height:1.6;">${expiry}</p>
        </td></tr>
        <tr><td style="padding:24px 12px 0;color:#77748e;font-size:12px;line-height:1.6;">${safety}<br><span style="color:#5145c4;">Jobbely · Find your next opportunity.</span></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}
