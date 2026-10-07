import { createServer } from 'node:net';
import type { Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { SmtpAccountMailer } from './smtp.js';

const cleanup: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((close) => close()));
});

async function localSmtp() {
  const messages: string[] = [];
  const sockets = new Set<Socket>();

  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 localhost test SMTP\r\n');

    let pending = '';
    let data = false;

    socket.on('data', (bytes) => {
      pending += bytes.toString();

      for (;;) {
        if (data) {
          const end = pending.indexOf('\r\n.\r\n');

          if (end < 0) {
            return;
          }

          messages.push(pending.slice(0, end));
          pending = pending.slice(end + 5);
          data = false;
          socket.write('250 queued\r\n');
        } else {
          const end = pending.indexOf('\r\n');

          if (end < 0) {
            return;
          }

          const line = pending.slice(0, end);

          pending = pending.slice(end + 2);

          if (/^(EHLO|HELO)/i.test(line)) {
            socket.write('250 localhost\r\n');
          } else if (/^STARTTLS/i.test(line)) {
            socket.write('454 TLS unavailable\r\n');
          } else if (/^DATA/i.test(line)) {
            data = true;
            socket.write('354 send message\r\n');
          } else if (/^QUIT/i.test(line)) {
            socket.end('221 bye\r\n');
          } else {
            socket.write('250 ok\r\n');
          }
        }
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Missing test SMTP port');
  }

  cleanup.push(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  return { port: address.port, messages };
}

describe('SMTP email transport', () => {
  it('delivers HTML and plain-text confirmation through SMTP to a loopback capture server', async () => {
    const smtp = await localSmtp();

    const mailer = new SmtpAccountMailer('accounts@example.invalid', {
      host: '127.0.0.1',
      port: smtp.port,
      secure: false,
      allowInsecureLocal: true,
    });

    try {
      await mailer.send({
        to: 'synthetic@example.invalid',
        code: '012345',
        purpose: 'register',
        expiresAt: '2099-01-01T00:00:00.000Z',
      });

      expect(smtp.messages).toHaveLength(1);
      expect(smtp.messages[0]).toContain('012345');
      expect(smtp.messages[0]).toContain('synthetic@example.invalid');
      expect(smtp.messages[0]).toContain('multipart/alternative');
      expect(smtp.messages[0]).toContain('Content-Type: text/html');
      expect(smtp.messages[0]).toContain('Content-Type: text/plain');
      expect(smtp.messages[0]).not.toContain('passwordHash');
    } finally {
      mailer.close();
    }
  });

  it('requires TLS by default and never forwards SMTP private errors', async () => {
    const smtp = await localSmtp();

    const mailer = new SmtpAccountMailer('accounts@example.invalid', {
      host: '127.0.0.1',
      port: smtp.port,
      secure: false,
      allowInsecureLocal: false,
    });

    try {
      await expect(
        mailer.send({
          to: 'synthetic@example.invalid',
          code: '654321',
          purpose: 'reset',
          expiresAt: '2099-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow('Account email delivery failed');

      expect(smtp.messages).toHaveLength(0);
    } finally {
      mailer.close();
    }

    expect(
      () =>
        new SmtpAccountMailer('accounts@example.invalid', {
          host: 'smtp.example.invalid',
          port: 25,
          secure: false,
          allowInsecureLocal: true,
        }),
    ).toThrow('loopback');
  });
});
