import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { MatchJobs } from '../application/resume/match-jobs.js';
import type { JobCatalog } from '../application/catalog.js';
import { errorSchema } from './schemas.js';
import {
  requirementsSchema,
  matchInputSchema,
  matchResponseSchema,
  jobMatchInputSchema,
  jobMatchResponseSchema,
} from './matching-schemas.js';
import { privateResumeRoute } from './private-resume-route.js';

export function registerMatchingRoutes(
  server: FastifyInstance,
  catalog: JobCatalog,
  matcher: MatchJobs,
  origin: string,
) {
  const app = server.withTypeProvider<TypeBoxTypeProvider>();

  app.post(
    '/api/v1/jobs/:id/resume-match',
    {
      ...privateResumeRoute(origin, 15),
      bodyLimit: 256 * 1024,
      schema: {
        operationId: 'compareJobResume',
        params: Type.Object({ id: Type.String({ maxLength: 100 }) }),
        body: jobMatchInputSchema,
        response: {
          200: jobMatchResponseSchema,
          400: errorSchema,
          403: errorSchema,
          404: errorSchema,
          413: errorSchema,
          415: errorSchema,
          429: errorSchema,
          500: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const job = await catalog.job(request.params.id);

      return job
        ? matcher.explain(job, request.body.profile)
        : reply.code(404).send({ code: 'not_found', message: 'This listing could not be found.' });
    },
  );

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
        ? matcher.requirements(job)
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
    async (request) => {
      const [result, companies] = await Promise.all([
        matcher.execute(request.body),
        catalog.coverage(),
      ]);

      return {
        ...result,
        items: result.items.map((item) => {
          const company = companies.find((entry) => entry.slug === item.job.companySlug);

          return {
            ...item,
            coverage:
              company?.status === 'healthy'
                ? 'Coverage verified against the checked official hiring inventory'
                : company?.status === 'demo'
                  ? 'Sample source; synthetic listings'
                  : 'Partial coverage; automatic verification has not passed for the latest sources',
          };
        }),
      };
    },
  );
}
