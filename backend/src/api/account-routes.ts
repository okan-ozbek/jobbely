import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { Accounts } from '../application/accounts/accounts.js';
import type { PasswordAccounts } from '../application/accounts/password-accounts.js';
import { PasswordAccountError } from '../domain/accounts/password.js';
import { AccountAccessError, freeAccess, freeMatchLimit } from '../domain/accounts/access.js';
import { initialPlans } from '../domain/accounts/plans.js';
import { sessionAbsoluteMs, signInAttemptMs } from '../domain/accounts/identity.js';
import { errorSchema } from './schemas.js';
import { privateResumeRoute } from './private-resume-route.js';

const providerSchema = Type.Union([Type.Literal('github'), Type.Literal('linkedin')]);
const strict = { additionalProperties: false };
const nullableString = Type.Union([Type.String(), Type.Null()]);

const accountErrors = {
  400: errorSchema,
  401: errorSchema,
  403: errorSchema,
  413: errorSchema,
  415: errorSchema,
  429: errorSchema,
  503: errorSchema,
};

function readCookie(request: FastifyRequest, name: string): string | undefined {
  const values = (request.headers.cookie ?? '')
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item.startsWith(`${name}=`));

  if (values.length > 1) {
    throw new AccountAccessError('authentication_required', 'Restart sign-in and try again.');
  }

  return values[0]?.slice(name.length + 1);
}

export function registerAccountRoutes(
  server: FastifyInstance,
  accounts: Accounts | undefined,
  origin: string,
  passwords?: PasswordAccounts,
) {
  const app = server.withTypeProvider<TypeBoxTypeProvider>();
  const secure = new URL(origin).protocol === 'https:';
  const sessionCookie = secure ? '__Host-jobbely_session' : 'jobbely_session';
  const browserCookie = secure ? '__Host-jobbely_login' : 'jobbely_login';

  function cookie(name: string, value: string, milliseconds: number) {
    return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(milliseconds / 1_000)}${secure ? '; Secure' : ''}`;
  }

  function service() {
    if (!accounts) {
      throw new AccountAccessError('access_unavailable', 'Sign-in is currently unavailable.');
    }

    return accounts;
  }

  const options = {
    logLevel: 'silent' as const,
    bodyLimit: 4_096,
    onRequest: [
      privateResumeRoute(origin, 60).onRequest,
      async (request: FastifyRequest, reply: FastifyReply) => {
        reply.header('Cache-Control', 'no-store');
        reply.header('Referrer-Policy', 'no-referrer');

        if (
          (request.method === 'POST' && request.headers.origin !== origin) ||
          (request.headers.origin && request.headers.origin !== origin)
        ) {
          return reply
            .code(403)
            .send({ code: 'origin_not_allowed', message: 'This browser origin is not allowed.' });
        }
      },
    ],
    errorHandler: (error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
      if (error instanceof PasswordAccountError) {
        const status =
          error.code === 'invalid_credentials'
            ? 401
            : error.code === 'rate_limited'
              ? 429
              : error.code === 'access_unavailable'
                ? 503
                : 400;

        if (status === 429) {
          reply.header('Retry-After', '900');
        }

        return reply.code(status).send({ code: error.code, message: error.message });
      }

      if (error.validation || [400, 413, 415].includes(error.statusCode ?? 0)) {
        return reply
          .code(error.statusCode ?? 400)
          .send({ code: 'invalid_request', message: 'Invalid account request.' });
      }

      const code = error instanceof AccountAccessError ? error.code : 'access_unavailable';

      return reply.code(code === 'authentication_required' ? 401 : 503).send({
        code,
        message:
          error instanceof AccountAccessError
            ? error.message
            : 'Could not read your account. Please try again.',
      });
    },
  };

  app.get(
    '/api/v1/plans',
    {
      schema: {
        operationId: 'listPlans',
        response: {
          200: Type.Object({
            matchingPolicy: Type.Object({ enabled: Type.Boolean(), previewLimit: Type.Integer() }),
            items: Type.Array(
              Type.Object({
                key: Type.String(),
                name: Type.String(),
                monthlyAmount: Type.Integer(),
                currency: Type.String(),
                interval: Type.Literal('month'),
                previewLimit: Type.Union([Type.Integer(), Type.Null()]),
                capabilities: Type.Array(Type.String()),
                purchasable: Type.Boolean(),
              }),
            ),
          }),
        },
      },
    },
    () => ({
      items: initialPlans,
      matchingPolicy: { enabled: false, previewLimit: freeMatchLimit },
    }),
  );

  app.get(
    '/api/v1/auth/providers',
    {
      ...options,
      schema: {
        operationId: 'signInProviders',
        response: {
          200: Type.Object({
            items: Type.Array(Type.Object({ name: providerSchema, available: Type.Boolean() })),
            emailAvailable: Type.Boolean(),
          }),
          ...accountErrors,
        },
      },
    },
    () => ({
      emailAvailable: !!passwords,
      items: accounts?.availableProviders() ?? [
        { name: 'github' as const, available: false },
        { name: 'linkedin' as const, available: false },
      ],
    }),
  );

  app.post(
    '/api/v1/auth/:provider/start',
    {
      ...options,
      onRequest: [privateResumeRoute(origin, 10).onRequest, ...options.onRequest],
      schema: {
        operationId: 'startSignIn',
        params: Type.Object({ provider: providerSchema }, strict),
        body: Type.Object({}, strict),
        response: {
          200: Type.Object({ authorizationUrl: Type.String() }),
          ...accountErrors,
        },
      },
    },
    async (request, reply) => {
      const result = await service().start(
        request.params.provider,
        readCookie(request, browserCookie),
      );

      reply.header('Set-Cookie', cookie(browserCookie, result.browser, signInAttemptMs));

      return { authorizationUrl: result.authorizationUrl };
    },
  );

  app.get(
    '/api/v1/auth/:provider/callback',
    {
      ...options,
      schema: {
        operationId: 'completeSignIn',
        params: Type.Object({ provider: providerSchema }, strict),
        querystring: Type.Object(
          {
            state: Type.String({ maxLength: 100 }),
            code: Type.Optional(Type.String({ maxLength: 2_048 })),
            error: Type.Optional(Type.String({ maxLength: 100 })),
          },
          strict,
        ),
        response: { 200: Type.String(), ...accountErrors },
      },
    },
    async (request, reply) => {
      if (request.query.error || !request.query.code) {
        throw new AccountAccessError(
          'authentication_required',
          'Sign-in was canceled. Please try again.',
        );
      }

      const result = await service().finish(
        request.params.provider,
        request.query.state,
        request.query.code,
        readCookie(request, browserCookie) ?? '',
      );

      reply.header('Set-Cookie', [
        cookie(sessionCookie, result.token, sessionAbsoluteMs),
        cookie(browserCookie, '', 0),
      ]);

      reply.header(
        'Content-Security-Policy',
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      );

      return reply
        .type('text/html')
        .send(
          '<!doctype html><html lang="en"><meta charset="utf-8"><title>Signed in to Jobbely</title><h1>You’re signed in.</h1><p>Return to your Jobbely tab to continue. You can close this tab.</p></html>',
        );
    },
  );

  app.get(
    '/api/v1/account',
    {
      ...options,
      schema: {
        operationId: 'currentAccount',
        response: {
          200: Type.Object({
            user: Type.Union([
              Type.Object({ id: Type.String(), email: nullableString, username: nullableString }),
              Type.Null(),
            ]),
            csrfToken: nullableString,
            access: Type.Object({
              userId: nullableString,
              planRevisionId: nullableString,
              capabilities: Type.Array(Type.String()),
              accessEndsAt: nullableString,
              policyVersion: Type.Literal('access-1'),
            }),
          }),
          ...accountErrors,
        },
      },
    },
    async (request) => {
      const token = readCookie(request, sessionCookie);
      const session = token !== undefined ? await service().current(token) : null;

      return {
        user: session
          ? {
              id: session.user.id,
              email: session.user.email,
              username: session.user.username ?? null,
            }
          : null,
        csrfToken: session?.csrfToken ?? null,
        access: { ...freeAccess(session?.user.id ?? null), capabilities: [] },
      };
    },
  );

  app.post(
    '/api/v1/auth/logout',
    {
      ...options,
      schema: {
        operationId: 'signOut',
        body: Type.Object({}, strict),
        response: {
          200: Type.Object({ signedOut: Type.Literal(true) }),
          ...accountErrors,
        },
      },
    },
    async (request, reply) => {
      await service().logout(
        readCookie(request, sessionCookie),
        typeof request.headers['x-csrf-token'] === 'string'
          ? request.headers['x-csrf-token']
          : undefined,
      );

      reply.header('Set-Cookie', cookie(sessionCookie, '', 0));

      return { signedOut: true as const };
    },
  );

  function passwordService() {
    if (!passwords) {
      throw new PasswordAccountError(
        'access_unavailable',
        'Email sign-in is currently unavailable.',
      );
    }

    return passwords;
  }

  app.post(
    '/api/v1/account/delete',
    {
      ...options,
      schema: {
        operationId: 'deleteAccount',
        body: Type.Object({ confirm: Type.Literal(true) }, strict),
        response: { 200: Type.Object({ deleted: Type.Literal(true) }), ...accountErrors },
      },
    },
    async (request, reply) => {
      await service().deleteAccount(
        readCookie(request, sessionCookie),
        typeof request.headers['x-csrf-token'] === 'string'
          ? request.headers['x-csrf-token']
          : undefined,
      );

      reply.header('Set-Cookie', [cookie(sessionCookie, '', 0), cookie(browserCookie, '', 0)]);

      return { deleted: true as const };
    },
  );

  const emailInput = Type.String({ minLength: 3, maxLength: 254 });
  const passwordInput = Type.String({ minLength: 1, maxLength: 256 });

  const codeInput = {
    challenge: Type.String({ pattern: '^[A-Za-z0-9_-]{43}$' }),
    code: Type.String({ pattern: '^\\d{6}$' }),
  };

  const codeResponse = Type.Object({
    challenge: Type.String(),
    message: Type.String(),
    expiresInSeconds: Type.Integer(),
  });

  app.post(
    '/api/v1/auth/register',
    {
      ...options,
      schema: {
        operationId: 'registerPasswordAccount',
        body: Type.Object(
          {
            email: emailInput,
            password: passwordInput,
            username: Type.Optional(Type.String({ maxLength: 30 })),
          },
          strict,
        ),
        response: { 200: codeResponse, ...accountErrors },
      },
    },
    async (request, reply) => {
      const result = await passwordService().requestCode(
        'register',
        request.body,
        request.ip,
        readCookie(request, browserCookie),
      );

      reply.header('Set-Cookie', cookie(browserCookie, result.browser, signInAttemptMs));

      return {
        challenge: result.challenge,
        message:
          'Check your email for a confirmation code. If you already have an account, sign in instead.',
        expiresInSeconds: 600,
      };
    },
  );

  app.post(
    '/api/v1/auth/register/confirm',
    {
      ...options,
      schema: {
        operationId: 'confirmPasswordAccount',
        body: Type.Object(codeInput, strict),
        response: { 200: Type.Object({ signedIn: Type.Literal(true) }), ...accountErrors },
      },
    },
    async (request, reply) => {
      const result = await passwordService().confirm(
        request.body.challenge,
        request.body.code,
        readCookie(request, browserCookie) ?? '',
        request.ip,
      );

      reply.header('Set-Cookie', [
        cookie(sessionCookie, result.token, sessionAbsoluteMs),
        cookie(browserCookie, '', 0),
      ]);

      return { signedIn: true as const };
    },
  );

  app.post(
    '/api/v1/auth/password/login',
    {
      ...options,
      schema: {
        operationId: 'passwordSignIn',
        body: Type.Object({ email: emailInput, password: passwordInput }, strict),
        response: { 200: Type.Object({ signedIn: Type.Literal(true) }), ...accountErrors },
      },
    },
    async (request, reply) => {
      const result = await passwordService().login(request.body, request.ip);

      reply.header('Set-Cookie', cookie(sessionCookie, result.token, sessionAbsoluteMs));

      return { signedIn: true as const };
    },
  );

  app.post(
    '/api/v1/auth/password/reset',
    {
      ...options,
      schema: {
        operationId: 'requestPasswordReset',
        body: Type.Object({ email: emailInput }, strict),
        response: { 200: codeResponse, ...accountErrors },
      },
    },
    async (request, reply) => {
      const result = await passwordService().requestCode(
        'reset',
        request.body,
        request.ip,
        readCookie(request, browserCookie),
      );

      reply.header('Set-Cookie', cookie(browserCookie, result.browser, signInAttemptMs));

      return {
        challenge: result.challenge,
        message: 'If an email/password account exists, a reset code will be emailed to you.',
        expiresInSeconds: 600,
      };
    },
  );

  app.post(
    '/api/v1/auth/password/reset/confirm',
    {
      ...options,
      schema: {
        operationId: 'completePasswordReset',
        body: Type.Object({ ...codeInput, password: passwordInput }, strict),
        response: { 200: Type.Object({ passwordReset: Type.Literal(true) }), ...accountErrors },
      },
    },
    async (request, reply) => {
      await passwordService().reset(
        request.body.challenge,
        request.body.code,
        request.body.password,
        readCookie(request, browserCookie) ?? '',
        request.ip,
      );

      reply.header('Set-Cookie', [cookie(sessionCookie, '', 0), cookie(browserCookie, '', 0)]);

      return { passwordReset: true as const };
    },
  );

  app.post(
    '/api/v1/auth/email/resend',
    {
      ...options,
      schema: {
        operationId: 'resendEmailCode',
        body: Type.Object({ challenge: codeInput.challenge }, strict),
        response: { 200: Type.Object({ accepted: Type.Literal(true) }), ...accountErrors },
      },
    },
    async (request) => {
      await passwordService().resend(
        request.body.challenge,
        readCookie(request, browserCookie) ?? '',
        request.ip,
      );

      return { accepted: true as const };
    },
  );
}
