import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { Accounts } from '../application/accounts/accounts.js';
import { AccountAccessError, hasCapability } from '../domain/accounts/access.js';
import { ResumeReviewError } from '../domain/resume/review.js';
import type { ReviewResume } from '../application/resume/review-resume.js';
import { readCookie } from './account-routes.js';
import { privateResumeRoute } from './private-resume-route.js';
import { errorSchema } from './schemas.js';
import { resumeReviewInputSchema, resumeReviewSchema } from './resume-review-schemas.js';
import { roleAssessmentInputSchema, roleAssessmentSchema } from './role-assessment-schemas.js';
import type { JobCatalog } from '../application/catalog.js';

export function registerResumeReviewRoutes(
  server: FastifyInstance,
  reviewer: ReviewResume,
  accounts: Accounts | undefined,
  origin: string,
  catalog?: JobCatalog,
) {
  const app = server.withTypeProvider<TypeBoxTypeProvider>();

  const cookie =
    new URL(origin).protocol === 'https:' ? '__Host-jobbely_session' : 'jobbely_session';

  const privateRoute = privateResumeRoute(origin, 10);

  async function access(request: FastifyRequest, csrf: boolean) {
    const token = readCookie(request, cookie);

    if (token === undefined) {
      return null;
    }

    if (!accounts) {
      throw new AccountAccessError(
        'access_unavailable',
        'Account access is currently unavailable.',
      );
    }

    const session = csrf
      ? await accounts.authorizedSession(
          token,
          typeof request.headers['x-csrf-token'] === 'string'
            ? request.headers['x-csrf-token']
            : undefined,
        )
      : await accounts.current(token);

    const entitlement = await accounts.resolve({ kind: 'account', binding: token });

    const enabled =
      !!session &&
      entitlement.userId === session.user.id &&
      entitlement.planRevisionId !== null &&
      Date.parse(entitlement.accessEndsAt ?? '') > Date.now() &&
      hasCapability(entitlement, 'resume_review');

    return { userId: session!.user.id, enabled };
  }

  const options = {
    logLevel: 'silent' as const,
    bodyLimit: 256 * 1024,
    onRequest: [
      privateRoute.onRequest,
      async (request: FastifyRequest, reply: FastifyReply) => {
        if (request.method === 'POST' && request.headers.origin !== origin) {
          return reply
            .code(403)
            .send({ code: 'origin_not_allowed', message: 'This browser origin is not allowed.' });
        }
      },
    ],
    errorHandler: (
      error: Error & { statusCode?: number; validation?: unknown },
      _request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      if (error instanceof AccountAccessError) {
        return reply
          .code(
            error.code === 'authentication_required'
              ? 401
              : error.code === 'upgrade_required'
                ? 403
                : 503,
          )
          .send({ code: error.code, message: error.message });
      }

      if (error instanceof ResumeReviewError) {
        return reply
          .code(error.code === 'review_busy' ? 429 : 400)
          .send({ code: error.code, message: error.message });
      }

      if (error.validation || [400, 413, 415].includes(error.statusCode ?? 0)) {
        return reply.code(error.statusCode ?? 400).send({
          code: 'invalid_review',
          message: 'Use bounded resume text and review settings.',
        });
      }

      return reply.code(503).send({
        code: 'review_unavailable',
        message: 'Could not review your resume. Please try again.',
      });
    },
  };

  const errors = {
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    413: errorSchema,
    415: errorSchema,
    429: errorSchema,
    503: errorSchema,
  };

  app.post(
    '/api/v1/jobs/:id/resume-assessment',
    {
      ...options,
      schema: {
        operationId: 'assessResumeRole',
        params: Type.Object(
          { id: Type.String({ minLength: 1, maxLength: 100 }) },
          { additionalProperties: false },
        ),
        body: roleAssessmentInputSchema,
        response: { 200: roleAssessmentSchema, 404: errorSchema, ...errors },
      },
    },
    async (request, reply) => {
      const current = await access(request, true);

      if (!current) {
        throw new AccountAccessError(
          'authentication_required',
          'Sign in to use the Pro AI assessment.',
        );
      }

      if (!current.enabled) {
        throw new AccountAccessError(
          'upgrade_required',
          'AI assessment requires active Pro access.',
        );
      }

      const job = await catalog?.job(request.params.id);

      if (!job) {
        return reply.code(404).send({ code: 'not_found', message: 'Job not found.' });
      }

      const controller = new AbortController();

      const disconnect = () => {
        if (!reply.raw.writableEnded) {
          controller.abort();
        }
      };

      reply.raw.on('close', disconnect);

      try {
        const result = await reviewer.assessRole(
          request.body.text,
          job,
          current.userId,
          controller.signal,
        );

        const latest = await access(request, true);

        if (!latest?.enabled || latest.userId !== current.userId) {
          throw new AccountAccessError(
            'upgrade_required',
            'Your Pro access changed. Refresh your account.',
          );
        }

        return result;
      } finally {
        reply.raw.off('close', disconnect);
      }
    },
  );

  app.get(
    '/api/v1/resume-review',
    {
      ...options,
      schema: {
        operationId: 'resumeReviewAvailability',
        response: {
          200: Type.Object({
            signedIn: Type.Boolean(),
            enabled: Type.Boolean(),
            aiAvailable: Type.Boolean(),
            aiProvider: Type.Union([
              Type.Literal('openai-api'),
              Type.Literal('codex-local'),
              Type.Null(),
            ]),
          }),
          ...errors,
        },
      },
    },
    async (request) => {
      const current = await access(request, false);

      return {
        signedIn: !!current,
        enabled: current?.enabled ?? false,
        aiAvailable: reviewer.aiAvailable,
        aiProvider: reviewer.aiProvider,
      };
    },
  );

  app.post(
    '/api/v1/resume-review',
    {
      ...options,
      schema: {
        operationId: 'reviewResume',
        body: resumeReviewInputSchema,
        response: { 200: resumeReviewSchema, ...errors },
      },
    },
    async (request, reply) => {
      const current = await access(request, true);

      if (!current) {
        throw new AccountAccessError(
          'authentication_required',
          'Sign in to use the Pro resume reviewer.',
        );
      }

      if (!current.enabled) {
        throw new AccountAccessError(
          'upgrade_required',
          'The resume reviewer requires an active Pro entitlement.',
        );
      }

      const controller = new AbortController();

      const disconnect = () => {
        if (!reply.raw.writableEnded) {
          controller.abort();
        }
      };

      reply.raw.on('close', disconnect);

      try {
        const result = await reviewer.execute(request.body, current.userId, controller.signal);
        const latest = await access(request, true);

        if (!latest?.enabled || latest.userId !== current.userId) {
          throw new AccountAccessError(
            'upgrade_required',
            'Your Pro access changed. Refresh your account.',
          );
        }

        return result;
      } finally {
        reply.raw.off('close', disconnect);
      }
    },
  );
}
