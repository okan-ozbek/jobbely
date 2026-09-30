import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { JobCatalog } from '../application/catalog.js';
import { QueryError } from '../application/catalog.js';
import { categories } from '../domain/taxonomy.js';
import type { JobRepository } from '../ports/ingestion.js';
import {
  companySchema,
  errorSchema,
  facetsSchema,
  filterSchema,
  jobSchema,
  listSchema,
} from './schemas.js';

export async function createApp(dependencies: {
  catalog: JobCatalog;
  repository: JobRepository;
  origin?: string;
  logger?: boolean;
}) {
  /**
   * Creates and configures the Fastify application instance with all routes, hooks, and error handling.
   *
   * @param dependencies - The dependencies required to create the app, including the job catalog, repository, origin, and logger.
   * @returns The configured Fastify application instance.
   */
  const app = Fastify({
    logger: dependencies.logger ?? false,
    ajv: { customOptions: { removeAdditional: false } },
  }).withTypeProvider<TypeBoxTypeProvider>();

  /**
   * Register CORS plugin for the Fastify application.
   */
  await app.register(cors, {
    origin: dependencies.origin ?? 'http://127.0.0.1:5173',
  });

  /**
   * Register Swagger plugin for the Fastify application.
   */
  await app.register(swagger, {
    openapi: { info: { title: 'Jobbely API', version: '0.1.0' } },
  });

  /**
   * Register the onClose hook to ensure the repository is properly closed when the application shuts down.
   *
   * @param dependencies - The dependencies required to create the app, including the job catalog, repository, origin, and logger.
   */
  app.addHook('onClose', () => dependencies.repository.close());

  /**
   * Register the global error handler for the Fastify application.
   * Handles QueryError, validation errors, and internal server errors.
   *
   * @param error - The error object encountered during request processing.
   * @param request - The Fastify request object.
   * @param reply - The Fastify reply object.
   */
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof QueryError) {
      const statusCode: number = error.code === 'cursor_stale' ? 409 : 400;

      return reply.code(statusCode).send({
        code: error.code,
        message: error.message,
      });
    }

    if (error instanceof Error && 'validation' in error) {
      return reply.code(400).send({
        code: 'invalid_request',
        message: 'Invalid request parameters',
      });
    }

    request.log.error(error);

    return reply.code(500).send({
      code: 'internal_error',
      message: 'Unable to read listings right now',
    });
  });

  /**
   * Handles the request to list all jobs based on the provided filters.
   *
   * @param request - The Fastify request object containing the query parameters.
   * @returns A list of jobs matching the provided filters.
   */
  app.get(
    '/api/v1/jobs',
    {
      schema: {
        operationId: 'listJobs',
        querystring: filterSchema,
        response: { 200: listSchema, 400: errorSchema, 409: errorSchema },
      },
    },
    (request) => dependencies.catalog.jobs(request.query),
  );

  /**
   * Handles the request to retrieve job facets based on the provided filters.
   *
   * @param request - The Fastify request object containing the query parameters.
   * @returns A list of job facets matching the provided filters.
   */
  app.get(
    '/api/v1/jobs/facets',
    {
      schema: {
        operationId: 'jobFacets',
        querystring: filterSchema,
        response: { 200: facetsSchema },
      },
    },
    (request) => dependencies.catalog.facets(request.query),
  );

  /**
   * Handles the request to retrieve a specific job by its ID.
   *
   * @param request - The Fastify request object containing the job ID as a path parameter.
   * @returns The job matching the provided ID, or a 404 error if not found.
   */
  app.get(
    '/api/v1/jobs/:id',
    {
      schema: {
        operationId: 'getJob',
        params: Type.Object({ id: Type.String({ maxLength: 100 }) }),
        response: { 200: jobSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const job = await dependencies.catalog.job(request.params.id);

      if (!job) {
        return reply.code(404).send({
          code: 'not_found',
          message: 'This listing could not be found',
        });
      }

      return job;
    },
  );

  /**
   * Handles the request to list all companies.
   *
   * @returns A list of all companies.
   */
  app.get(
    '/api/v1/companies',
    {
      schema: {
        operationId: 'listCompanies',
        response: { 200: Type.Array(companySchema) },
      },
    },
    () => dependencies.catalog.coverage(),
  );

  /**
   * Handles the request to retrieve a specific company by its slug.
   *
   * @param request - The Fastify request object containing the company slug as a path parameter.
   * @returns The company matching the provided slug, or a 404 error if not found.
   */
  app.get(
    '/api/v1/companies/:slug',
    {
      schema: {
        operationId: 'getCompany',
        params: Type.Object({ slug: Type.String({ maxLength: 100 }) }),
        response: { 200: companySchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const company = (await dependencies.catalog.coverage()).find(
        (item) => item.slug === request.params.slug,
      );

      if (!company) {
        return reply.code(404).send({
          code: 'not_found',
          message: 'Company not found',
        });
      }

      return company;
    },
  );

  /**
   * Handles the request to list all categories.
   *
   * @returns A list of all categories.
   */
  app.get(
    '/api/v1/categories',
    {
      schema: {
        operationId: 'listCategories',
        response: {
          200: Type.Array(Type.Object({ slug: Type.String(), name: Type.String() })),
        },
      },
    },
    () => [...categories],
  );

  /**
   * Handles the liveness probe for the application.
   *
   * @returns The status of the application.
   */
  app.get('/health/live', async () => ({ status: 'ok' }));

  /**
   * Handles the readiness probe for the application.
   *
   * @returns The status of the application.
   */
  app.get('/health/ready', async (_request, reply) => {
    try {
      await dependencies.repository.ping();

      return { status: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  await app.ready();

  return app;
}
