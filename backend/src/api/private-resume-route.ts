import type { FastifyReply, FastifyRequest, FastifyError, HookHandlerDoneFunction } from 'fastify';
import { ResumeInputError } from '../application/resume/analyze-resume.js';
import { MatchError } from '../application/resume/match-jobs.js';

export function privateResumeRoute(origin: string, maximum = 60) {
  const windows = new Map<string, { expires: number; count: number }>();

  return {
    onRequest(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) {
      reply.header('Cache-Control', 'no-store');

      if (request.headers.origin && request.headers.origin !== origin) {
        void reply
          .code(403)
          .send({ code: 'origin_not_allowed', message: 'This browser origin is not allowed.' });

        return;
      }

      const now = Date.now();

      for (const [key, window] of windows) {
        if (window.expires <= now) {
          windows.delete(key);
        }
      }

      const window = windows.get(request.ip) ?? { expires: now + 60_000, count: 0 };

      if (window.count >= maximum || (!windows.has(request.ip) && windows.size >= 1_000)) {
        reply.header('Retry-After', '60');

        void reply.code(429).send({
          code: 'rate_limited',
          message: 'Too many requests. Wait a minute and try again.',
        });

        return;
      }

      window.count++;
      windows.set(request.ip, window);
      done();
    },
    errorHandler(error: FastifyError, _request: FastifyRequest, reply: FastifyReply) {
      if (error instanceof MatchError) {
        return reply
          .code(
            error.code === 'cursor_stale' ? 409 : error.code === 'capacity_exceeded' ? 503 : 400,
          )
          .send({ code: error.code, message: error.message });
      }

      if (error instanceof ResumeInputError || error.validation || error.statusCode === 400) {
        return reply.code(400).send({
          code: 'invalid_resume',
          message:
            error instanceof ResumeInputError
              ? error.message
              : 'Invalid profile input or corrections.',
        });
      }

      if (error.statusCode === 413 || error.statusCode === 415) {
        return reply.code(error.statusCode).send({
          code: 'unsupported_input',
          message: 'Use bounded text or profile JSON. Raw document uploads are not accepted.',
        });
      }

      return reply.code(500).send({
        code: 'analysis_failed',
        message: 'Could not process this request. Please try again.',
      });
    },
  };
}
