import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { AnalyzeResume } from '../application/resume/analyze-resume.js';
import { errorSchema } from './schemas.js';
import { resumeAnalysisSchema, resumeInputSchema } from './resume-schemas.js';
import { privateResumeRoute } from './private-resume-route.js';

export function registerResumeRoutes(
  server: FastifyInstance,
  analyzer: AnalyzeResume,
  origin: string,
) {
  server.withTypeProvider<TypeBoxTypeProvider>().post(
    '/api/v1/resume-analysis',
    {
      ...privateResumeRoute(origin),
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
    },
    (request) => analyzer.execute(request.body),
  );
}
