import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { AnalyzeResume } from '../application/resume/analyze-resume.js';
import { ResumeInputError } from '../application/resume/analyze-resume.js';
import { errorSchema } from './schemas.js';
import { resumeAnalysisSchema, resumeInputSchema } from './resume-schemas.js';

export function registerResumeRoutes(
  server: FastifyInstance,
  analyzer: AnalyzeResume,
  origin: string,
) {
  const app = server.withTypeProvider<TypeBoxTypeProvider>();
  const windows = new Map<string, { expires: number; count: number }>();

  app.post(
    '/api/v1/resume-analysis',
    {
      bodyLimit: 768 * 1024,
      schema: {
        operationId: 'analyzeResume',
        body: resumeInputSchema,
        response: {
          200: resumeAnalysisSchema,
          400: errorSchema,
          403: errorSchema,
          413: errorSchema,
          415: errorSchema,
          429: errorSchema,
          500: errorSchema,
        },
      },
      onRequest(request, reply, done) {
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

        if (window.count >= 60 || (!windows.has(request.ip) && windows.size >= 1_000)) {
          reply.header('Retry-After', '60');

          void reply.code(429).send({
            code: 'rate_limited',
            message: 'Too many analysis requests. Wait a minute and try again.',
          });

          return;
        }

        window.count++;
        windows.set(request.ip, window);
        done();
      },
      errorHandler(error, _request, reply) {
        if (error instanceof ResumeInputError || error.validation || error.statusCode === 400) {
          return reply.code(400).send({
            code: 'invalid_resume',
            message:
              error instanceof ResumeInputError
                ? error.message
                : 'Invalid resume input or corrections.',
          });
        }

        if (error.statusCode === 413 || error.statusCode === 415) {
          return reply.code(error.statusCode).send({
            code: 'unsupported_input',
            message:
              'Use bounded pasted text in a JSON request. File uploads are not supported yet.',
          });
        }

        // Never log private input, exception payloads or resume-derived messages.
        return reply.code(500).send({
          code: 'analysis_failed',
          message: 'Could not analyze this text. Please try again.',
        });
      },
    },
    (request) => analyzer.execute(request.body),
  );
}
