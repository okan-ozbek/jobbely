import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import { Type } from "@sinclair/typebox";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { JobCatalog } from "../application/catalog.js";
import { QueryError } from "../application/catalog.js";
import { categories } from "../domain/taxonomy.js";
import type { JobRepository } from "../ports/ingestion.js";
import {
  companySchema,
  errorSchema,
  facetsSchema,
  filterSchema,
  jobSchema,
  listSchema,
} from "./schemas.js";

export async function createApp(dependencies: {
  catalog: JobCatalog;
  repository: JobRepository;
  origin?: string;
  logger?: boolean;
}) {
  const app = Fastify({
    logger: dependencies.logger ?? false,
    ajv: { customOptions: { removeAdditional: false } },
  }).withTypeProvider<TypeBoxTypeProvider>();
  await app.register(cors, {
    origin: dependencies.origin ?? "http://127.0.0.1:5173",
  });
  await app.register(swagger, {
    openapi: { info: { title: "Jobbely API", version: "0.1.0" } },
  });
  app.addHook("onClose", () => dependencies.repository.close());
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof QueryError)
      return reply
        .code(error.code === "cursor_stale" ? 409 : 400)
        .send({ code: error.code, message: error.message });
    if (error instanceof Error && "validation" in error)
      return reply
        .code(400)
        .send({
          code: "invalid_request",
          message: "Invalid request parameters",
        });
    request.log.error(error);
    return reply
      .code(500)
      .send({
        code: "internal_error",
        message: "Unable to read listings right now",
      });
  });
  app.get(
    "/api/v1/jobs",
    {
      schema: {
        operationId: "listJobs",
        querystring: filterSchema,
        response: { 200: listSchema, 400: errorSchema, 409: errorSchema },
      },
    },
    (request) => dependencies.catalog.jobs(request.query),
  );
  app.get(
    "/api/v1/jobs/facets",
    {
      schema: {
        operationId: "jobFacets",
        querystring: filterSchema,
        response: { 200: facetsSchema },
      },
    },
    (request) => dependencies.catalog.facets(request.query),
  );
  app.get(
    "/api/v1/jobs/:id",
    {
      schema: {
        operationId: "getJob",
        params: Type.Object({ id: Type.String({ maxLength: 100 }) }),
        response: { 200: jobSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const job = await dependencies.catalog.job(request.params.id);
      return (
        job ??
        reply
          .code(404)
          .send({
            code: "not_found",
            message: "This listing could not be found",
          })
      );
    },
  );
  app.get(
    "/api/v1/companies",
    {
      schema: {
        operationId: "listCompanies",
        response: { 200: Type.Array(companySchema) },
      },
    },
    () => dependencies.catalog.coverage(),
  );
  app.get(
    "/api/v1/companies/:slug",
    {
      schema: {
        operationId: "getCompany",
        params: Type.Object({ slug: Type.String({ maxLength: 100 }) }),
        response: { 200: companySchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const company = (await dependencies.catalog.coverage()).find(
        (item) => item.slug === request.params.slug,
      );
      return (
        company ??
        reply
          .code(404)
          .send({ code: "not_found", message: "Company not found" })
      );
    },
  );
  app.get(
    "/api/v1/categories",
    {
      schema: {
        operationId: "listCategories",
        response: {
          200: Type.Array(
            Type.Object({ slug: Type.String(), name: Type.String() }),
          ),
        },
      },
    },
    () => [...categories],
  );
  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await dependencies.repository.ping();
      return { status: "ok" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });
  await app.ready();
  return app;
}
