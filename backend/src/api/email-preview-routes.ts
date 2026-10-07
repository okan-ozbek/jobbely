import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { AccountEmail } from '../ports/password-accounts.js';
import { errorSchema } from './schemas.js';

export function registerEmailPreviewRoutes(
  instance: FastifyInstance,
  render?: (message: AccountEmail) => { html: string },
) {
  const app = instance.withTypeProvider<TypeBoxTypeProvider>();

  app.get(
    '/api/v1/email-preview/:purpose',
    {
      schema: {
        operationId: 'previewAccountEmail',
        description:
          'Unprotected HTML template preview using a fixed sample code. Does not send email or access account data. Admin authorization is deferred.',
        params: Type.Object(
          {
            purpose: Type.Union([
              Type.Literal('register'),
              Type.Literal('reset'),
              Type.Literal('change-email'),
            ]),
          },
          { additionalProperties: false },
        ),
        querystring: Type.Object({}, { additionalProperties: false }),
        response: {
          200: {
            description: 'Rendered account email with a fixed sample code',
            content: { 'text/html': { schema: Type.String() } },
          },
          400: errorSchema,
          503: errorSchema,
        },
      },
      onRequest: async (_request, reply) => {
        reply.header('Cache-Control', 'no-store');

        reply.header(
          'Content-Security-Policy',
          "default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
        );

        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('Referrer-Policy', 'no-referrer');
        reply.header('X-Robots-Tag', 'noindex, nofollow');
      },
    },
    (request, reply) => {
      if (!render) {
        reply.code(503);

        return { code: 'preview_unavailable', message: 'Email preview is unavailable.' };
      }

      const email = render({
        to: 'example@jobbely.com',
        code: '012345',
        purpose: request.params.purpose,
        expiresAt: '2099-01-01T00:00:00.000Z',
      });

      reply.type('text/html; charset=utf-8');

      return email.html.replace(
        '</head>',
        '<link rel="stylesheet" href="/fonts/galdeano.css"></head>',
      );
    },
  );
}
