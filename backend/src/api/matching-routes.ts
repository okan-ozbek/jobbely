import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { MatchJobs } from '../application/resume/match-jobs.js';
import type { JobCatalog } from '../application/catalog.js';
import { extractRequirements } from '../domain/matching/requirements.js';
import { errorSchema } from './schemas.js';
import { requirementsSchema, matchInputSchema, matchResponseSchema } from './matching-schemas.js';
import { privateResumeRoute } from './private-resume-route.js';

export function registerMatchingRoutes(
  server: FastifyInstance,
  catalog: JobCatalog,
  matcher: MatchJobs,
  origin: string,
) {
  const app = server.withTypeProvider<TypeBoxTypeProvider>();

  app.get(
    '/api/v1/jobs/:id/requirements',
    {
      schema: {
        operationId: 'getJobRequirements',
        params: Type.Object({ id: Type.String({ maxLength: 100 }) }),
        response: { 200: requirementsSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const job = await catalog.job(request.params.id);

      return job
        ? extractRequirements(job)
        : reply.code(404).send({ code: 'not_found', message: 'This listing could not be found.' });
    },
  );

  app.post(
    '/api/v1/resume-matches',
    {
      ...privateResumeRoute(origin, 15),
      bodyLimit: 256 * 1024,
      schema: {
        operationId: 'matchResume',
        body: matchInputSchema,
        response: {
          200: matchResponseSchema,
          400: errorSchema,
          403: errorSchema,
          409: errorSchema,
          413: errorSchema,
          415: errorSchema,
          429: errorSchema,
          500: errorSchema,
          503: errorSchema,
        },
      },
    },
    (request) => matcher.execute(request.body),
  );
}
