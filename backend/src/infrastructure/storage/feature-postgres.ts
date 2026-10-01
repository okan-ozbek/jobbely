import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../../generated/prisma/client.js';
import type { SourceRun } from '../../domain/model.js';
import type { FeatureInput, FeatureJob, StoredFeature } from '../../domain/matching/model.js';
import { featureVersion } from '../../domain/matching/requirements.js';
import type { FeatureFilter, JobFeatureRepository } from '../../ports/job-features.js';

function where(filter: FeatureFilter) {
  return Prisma.sql`p."status" = 'active' AND p."sourceId" = ANY(${filter.sourceIds}::text[]) AND p."category" = ANY(${filter.categories}::text[]) AND p."payload"->>'lastSeenAt' >= ${filter.cutoff} AND p."payload"->>'missingSince' IS NULL`;
}

export class PostgresJobFeatures implements JobFeatureRepository {
  private readonly client: PrismaClient;

  constructor(connectionString: string) {
    this.client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  async close() {
    await this.client.$disconnect();
  }

  async pendingFeatures(after: string, limit: number) {
    const rows = await this.client.$queryRaw<
      { payload: FeatureInput }[]
    >`SELECT p."payload" FROM "Posting" p LEFT JOIN "JobFeature" f ON f."postingId" = p."id" WHERE p."id" > ${after} AND (f."contentHash" IS DISTINCT FROM p."contentHash" OR f."version" IS DISTINCT FROM ${featureVersion}) ORDER BY p."id" LIMIT ${limit}`;

    return rows.map((row) => row.payload);
  }

  async saveFeatures(features: StoredFeature[]) {
    return this.client.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(721049)`;

        let updated = 0;

        for (const feature of [...features].sort((a, b) =>
          a.postingId.localeCompare(b.postingId),
        )) {
          // Lock the current input until publication completes; concurrent ingestion must wait.
          const current = await transaction.$queryRaw<
            { id: string }[]
          >`SELECT "id" FROM "Posting" WHERE "id" = ${feature.postingId} AND "contentHash" = ${feature.requirements.contentHash} FOR SHARE`;

          if (!current.length) {
            continue;
          }

          updated +=
            await transaction.$executeRaw`INSERT INTO "JobFeature" ("postingId", "contentHash", "version", "category", "skillIds", "payload") VALUES (${feature.postingId}, ${feature.requirements.contentHash}, ${feature.requirements.version}, ${feature.requirements.category}, ${feature.requirements.skills.flatMap((group) => group.alternatives.map((item) => item.id))}::text[], ${JSON.stringify(feature.requirements)}::jsonb) ON CONFLICT ("postingId") DO UPDATE SET "contentHash" = EXCLUDED."contentHash", "version" = EXCLUDED."version", "category" = EXCLUDED."category", "skillIds" = EXCLUDED."skillIds", "payload" = EXCLUDED."payload" WHERE "JobFeature"."contentHash" IS DISTINCT FROM EXCLUDED."contentHash" OR "JobFeature"."version" IS DISTINCT FROM EXCLUDED."version"`;
        }

        if (updated) {
          await transaction.datasetVersion.upsert({
            where: { id: 1 },
            create: { id: 1, featureGeneration: 1 },
            update: { featureGeneration: { increment: 1 } },
          });
        }

        return updated;
      },
      { timeout: 30_000 },
    );
  }

  async latestRuns() {
    const rows = await this.client.$queryRaw<
      { payload: SourceRun }[]
    >`SELECT DISTINCT ON ("sourceId") "payload" FROM "Run" WHERE "status" <> 'running' ORDER BY "sourceId", "payload"->>'finishedAt' DESC, "id" DESC`;

    return rows.map((row) => row.payload);
  }

  async featureSnapshot(filter: FeatureFilter) {
    return this.client.$transaction(
      async (transaction) => {
        const version = await transaction.datasetVersion.findUnique({ where: { id: 1 } });

        const [counts] = await transaction.$queryRaw<
          { eligible: bigint; unenriched: bigint }[]
        >`SELECT count(*) AS eligible, count(*) FILTER (WHERE f."contentHash" IS DISTINCT FROM p."contentHash" OR f."version" IS DISTINCT FROM ${featureVersion}) AS unenriched FROM "Posting" p LEFT JOIN "JobFeature" f ON p."id" = f."postingId" WHERE ${where(filter)}`;

        return {
          datasetVersion: version?.version ?? 0,
          generation: version?.featureGeneration ?? 0,
          eligible: Number(counts?.eligible ?? 0),
          unenriched: Number(counts?.unenriched ?? 0),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async featureJobs(filter: FeatureFilter, after: string, limit: number) {
    return this.client.$queryRaw<
      FeatureJob[]
    >`SELECT p."id", p."sourceId", p."companySlug", p."title", p."payload"->>'url' AS url, p."payload"->>'applyUrl' AS "applyUrl", p."payload"->>'lastSeenAt' AS "lastSeenAt", f."payload" AS requirements FROM "Posting" p JOIN "JobFeature" f ON p."id" = f."postingId" AND p."contentHash" = f."contentHash" AND f."version" = ${featureVersion} WHERE ${where(filter)} AND p."id" > ${after} ORDER BY p."id" LIMIT ${limit}`;
  }
}
