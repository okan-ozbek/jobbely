import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../../generated/prisma/client.js';
import type { Dataset, Job, Source, SourceRun } from '../../domain/model.js';
import type { JobRepository, SnapshotCommit } from '../../ports/ingestion.js';
import { applySnapshot } from './snapshot.js';
import type { CatalogEntry, CatalogFilter } from '../../ports/catalog.js';

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function* batches<T>(items: T[], size: number) {
  for (let offset = 0; offset < items.length; offset += size) {
    yield items.slice(offset, offset + size);
  }
}

export class PostgresJobRepository implements JobRepository {
  private readonly client: PrismaClient;

  constructor(connectionString: string) {
    this.client = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  private async readWithin(
    transaction: Prisma.TransactionClient,
    sourceId?: string,
  ): Promise<Dataset> {
    const [version, postings, runs] = await Promise.all([
      transaction.datasetVersion.findUnique({ where: { id: 1 } }),
      sourceId
        ? transaction.posting.findMany({ where: { sourceId } })
        : transaction.posting.findMany(),
      sourceId ? transaction.run.findMany({ where: { sourceId } }) : transaction.run.findMany(),
    ]);

    return {
      version: version?.version ?? 0,
      jobs: postings.map((row) => row.payload as unknown as Job),
      runs: runs.map((row) => row.payload as unknown as SourceRun),
    };
  }

  async read(): Promise<Dataset> {
    return this.client.$transaction((transaction) => this.readWithin(transaction), {
      isolationLevel: 'RepeatableRead',
    });
  }

  async findJob(id: string): Promise<Job | null> {
    const row = await this.client.posting.findUnique({ where: { id }, select: { payload: true } });

    return row ? (row.payload as unknown as Job) : null;
  }

  async searchCatalog(query: CatalogFilter) {
    const conditions = [Prisma.sql`p."status" = 'active'`];

    if (query.company) {
      conditions.push(Prisma.sql`p."companySlug" = ANY(${query.company.split(',')}::text[])`);
    }

    if (query.category) {
      conditions.push(Prisma.sql`p."category" = ANY(${query.category.split(',')}::text[])`);
    }

    if (query.workplace) {
      conditions.push(Prisma.sql`p."workplace" = ANY(${query.workplace.split(',')}::text[])`);
    }

    if (query.q) {
      conditions.push(Prisma.sql`
        strpos(lower(concat(p."title", ' ', p."payload"->>'descriptionText', ' ',
          (SELECT string_agg(value, ' ' ORDER BY ordinal) FROM jsonb_array_elements_text(p."payload"->'departments') WITH ORDINALITY d(value, ordinal)), ' ',
          (SELECT string_agg(value, ' ' ORDER BY ordinal) FROM jsonb_array_elements_text(p."payload"->'locations') WITH ORDINALITY l(value, ordinal)))), ${query.q.toLowerCase()}) > 0
      `);
    }

    return this.client.$transaction(
      async (transaction) => {
        const version = await transaction.datasetVersion.findUnique({ where: { id: 1 } });

        const jobs = await transaction.$queryRaw<CatalogEntry[]>(Prisma.sql`
          SELECT p."id", p."companySlug", p."category", p."locations", p."workplace", p."lastSeenAt"
          FROM "Posting" p WHERE ${Prisma.join(conditions, ' AND ')}
        `);

        return { version: version?.version ?? 0, jobs };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async findJobs(ids: string[], version: number): Promise<Job[] | null> {
    return this.client.$transaction(
      async (transaction) => {
        const current = await transaction.datasetVersion.findUnique({ where: { id: 1 } });

        if ((current?.version ?? 0) !== version) {
          return null;
        }

        const rows = await transaction.posting.findMany({
          where: { id: { in: ids } },
          select: { payload: true },
        });

        return rows.map((row) => row.payload as unknown as Job);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async coverageSnapshot(companySlugs: string[], sourceIds: string[]) {
    return this.client.$transaction(
      async (transaction) => {
        const counts = await transaction.posting.groupBy({
          by: ['companySlug'],
          where: { companySlug: { in: companySlugs }, status: 'active' },
          _count: { _all: true },
        });

        const rows = await transaction.$queryRaw<{ payload: SourceRun }[]>`
          SELECT DISTINCT ON (r."id") r."id", r."payload" FROM (
            (SELECT DISTINCT ON ("sourceId") "id", "payload" FROM "Run"
              WHERE "sourceId" = ANY(${sourceIds}::text[])
              ORDER BY "sourceId", "payload"->>'startedAt' DESC, "id" DESC)
            UNION ALL
            (SELECT DISTINCT ON ("sourceId") "id", "payload" FROM "Run"
              WHERE "sourceId" = ANY(${sourceIds}::text[]) AND "status" = 'succeeded'
                AND "payload"->>'enumerationComplete' = 'true'
              ORDER BY "sourceId", "payload"->>'startedAt' DESC, "id" DESC)
          ) r ORDER BY r."id"
        `;

        return {
          counts: Object.fromEntries(counts.map((row) => [row.companySlug, row._count._all])),
          runs: rows.map((row) => row.payload),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async startRun(source: Source, at: string) {
    return this.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${source.id}))`;

      const lease = await transaction.sourceLease.findUnique({
        where: { sourceId: source.id },
      });

      if (lease && lease.expiresAt.getTime() > Date.parse(at)) {
        return null;
      }

      if (lease) {
        const old = await transaction.run.findUnique({
          where: { id: lease.runId },
        });

        if (old?.status === 'running') {
          await transaction.run.update({
            where: { id: old.id },
            data: {
              status: 'failed',
              payload: json({
                ...(old.payload as unknown as SourceRun),
                status: 'failed',
                finishedAt: at,
                error: 'Worker lease expired',
              }),
            },
          });
        }
      }

      const run: SourceRun = {
        id: randomUUID(),
        sourceId: source.id,
        startedAt: at,
        finishedAt: null,
        status: 'running',
        listingCount: 0,
        excludedCount: 0,
        enumerationComplete: false,
        removalsQuarantined: false,
        error: null,
      };

      await transaction.run.create({
        data: {
          id: run.id,
          sourceId: source.id,
          status: run.status,
          payload: json(run),
        },
      });

      await transaction.sourceLease.upsert({
        where: { sourceId: source.id },
        create: {
          sourceId: source.id,
          runId: run.id,
          expiresAt: new Date(Date.parse(at) + 30 * 60_000),
        },
        update: {
          runId: run.id,
          expiresAt: new Date(Date.parse(at) + 30 * 60_000),
        },
      });

      return run;
    });
  }

  async renewRun(sourceId: string, runId: string, at: string): Promise<boolean> {
    const updated = await this.client.sourceLease.updateMany({
      where: { sourceId, runId, expiresAt: { gt: new Date(at) } },
      data: { expiresAt: new Date(Date.parse(at) + 30 * 60_000) },
    });

    return updated.count === 1;
  }

  async commitSnapshot(commit: SnapshotCommit) {
    return this.client.$transaction(
      async (transaction) => {
        // Serialize publications, including their shared dataset version. API reads see one committed snapshot.
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(721049)`;
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${commit.source.id}))`;

        const lease = await transaction.sourceLease.findUnique({
          where: { sourceId: commit.source.id },
        });

        if (
          lease?.runId !== commit.runId ||
          lease.expiresAt.getTime() <= Date.parse(commit.observedAt)
        ) {
          throw new Error('Source lease was lost or expired');
        }

        const before = await this.readWithin(transaction, commit.source.id);
        const result = applySnapshot(before, commit);

        const sourceJobs = result.dataset.jobs.filter((job) => job.sourceId === commit.source.id);

        // One parameterized JSON batch replaces thousands of sequential round trips.
        // All batches remain in the same transaction, including versions and evidence.
        for (const batch of batches(sourceJobs, 250)) {
          const values = JSON.stringify(
            batch.map((job) => ({
              id: job.id,
              sourceId: job.sourceId,
              sourcePostingId: job.sourcePostingId,
              companySlug: job.companySlug,
              category: job.classification.category,
              status: job.status,
              title: job.title,
              contentHash: job.contentHash,
              payload: job,
            })),
          );

          await transaction.$executeRaw`
            INSERT INTO "Posting" ("id","sourceId","sourcePostingId","companySlug","category","status","title","contentHash","payload")
            SELECT value->>'id',value->>'sourceId',value->>'sourcePostingId',value->>'companySlug',value->>'category',value->>'status',value->>'title',value->>'contentHash',value->'payload'
            FROM jsonb_array_elements(${values}::jsonb)
            ON CONFLICT ("id") DO UPDATE SET
              "sourceId"=EXCLUDED."sourceId","sourcePostingId"=EXCLUDED."sourcePostingId",
              "companySlug"=EXCLUDED."companySlug","category"=EXCLUDED."category",
              "status"=EXCLUDED."status","title"=EXCLUDED."title",
              "contentHash"=EXCLUDED."contentHash","payload"=EXCLUDED."payload"
          `;
        }

        for (const batch of batches(result.changed, 250)) {
          await transaction.postingVersion.createMany({
            data: batch.map((job) => ({
              postingId: job.id,
              observedAt: new Date(commit.observedAt),
              contentHash: job.contentHash,
              payload: json(job),
            })),
          });
        }

        for (const batch of batches(commit.rawResponses, 10)) {
          await transaction.snapshot.createMany({
            data: batch.map((raw) => ({
              runId: commit.runId,
              sourceId: commit.source.id,
              url: raw.url,
              fetchedAt: new Date(raw.fetchedAt),
              payload: json(
                raw.request
                  ? { format: 'http-exchange-v1', request: raw.request, body: raw.body }
                  : raw.body,
              ),
            })),
          });
        }

        await transaction.run.update({
          where: { id: commit.runId },
          data: { status: result.run.status, payload: json(result.run) },
        });

        await transaction.datasetVersion.upsert({
          where: { id: 1 },
          create: { id: 1, version: result.dataset.version },
          update: { version: result.dataset.version },
        });

        await transaction.sourceLease.delete({
          where: { sourceId: commit.source.id },
        });

        return result.run;
      },
      { timeout: 60_000 },
    );
  }

  async failRun(runId: string, at: string, error: string) {
    await this.client.$transaction(async (transaction) => {
      const row = await transaction.run.findUnique({ where: { id: runId } });

      if (!row || row.status !== 'running') {
        return;
      }

      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${row.sourceId}))`;

      const current = await transaction.run.findUnique({
        where: { id: runId },
      });

      if (!current || current.status !== 'running') {
        return;
      }

      await transaction.run.update({
        where: { id: runId },
        data: {
          status: 'failed',
          payload: json({
            ...(current.payload as unknown as SourceRun),
            status: 'failed',
            finishedAt: at,
            error,
          }),
        },
      });

      await transaction.sourceLease.deleteMany({ where: { runId } });
    });
  }

  async ping() {
    await this.client.$queryRaw`SELECT 1`;
  }

  async close() {
    await this.client.$disconnect();
  }
}
