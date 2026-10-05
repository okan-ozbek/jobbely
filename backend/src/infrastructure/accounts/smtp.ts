import nodemailer from 'nodemailer';
import type { AccountEmail } from '../../ports/password-accounts.js';
import type { AccountMailer } from './account-email-queue.js';

export class SmtpAccountMailer implements AccountMailer {
  private readonly transport: ReturnType<typeof nodemailer.createTransport>;

  constructor(
    private readonly from: string,
    configuration: {
      host: string;
      port: number;
      secure: boolean;
      allowInsecureLocal: boolean;
      username?: string;
      password?: string;
    },
  ) {
    if (
      configuration.allowInsecureLocal &&
      !['127.0.0.1', 'localhost', '::1'].includes(configuration.host)
    ) {
      throw new Error('Plain SMTP is restricted to loopback development');
    }

    this.transport = nodemailer.createTransport({
      host: configuration.host,
      port: configuration.port,
      secure: configuration.secure,
      requireTLS: !configuration.allowInsecureLocal,
      ignoreTLS: configuration.allowInsecureLocal,
      ...(configuration.username && configuration.password
        ? { auth: { user: configuration.username, pass: configuration.password } }
        : {}),
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
      disableFileAccess: true,
      disableUrlAccess: true,
      logger: false,
      debug: false,
    });
  }

  async send(message: AccountEmail) {
    const action = message.purpose === 'register' ? 'Confirm your email' : 'Reset your password';
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        this.transport
          .sendMail({
            from: { name: 'Jobbely', address: this.from },
            to: message.to,
            subject: `${action} — Jobbely`,
            text: `${action} with this code:\n\n${message.code}\n\nThe code expires in ten minutes from your request and can be used once. Never share it. If you did not request this, ignore this email.`,
          })
          .then((result) => {
            if (!result.accepted.length) {
              throw new Error('Email rejected');
            }
          }),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            this.transport.close();
            reject(new Error('Email delivery timed out'));
          }, 30_000);
        }),
      ]);
    } catch {
      // SMTP failures may contain private addresses, codes and credentials.
      throw new Error('Account email delivery failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  close() {
    this.transport.close();
  }
}
