import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Dataset, Job, Source, SourceRun } from '../../domain/model.js';
import type { JobRepository, SnapshotCommit } from '../../ports/ingestion.js';
import { applySnapshot } from './snapshot.js';

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PostgresJobRepository implements JobRepository {
  private readonly client: PrismaClient;

  constructor(connectionString: string) {
    this.client = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  private async readWithin(transaction: Prisma.TransactionClient): Promise<Dataset> {
    const [version, postings, runs] = await Promise.all([
      transaction.datasetVersion.findUnique({ where: { id: 1 } }),
      transaction.posting.findMany(),
      transaction.run.findMany(),
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

        const before = await this.readWithin(transaction);
        const result = applySnapshot(before, commit);

        for (const job of result.dataset.jobs.filter((job) => job.sourceId === commit.source.id)) {
          const values = {
            sourceId: job.sourceId,
            sourcePostingId: job.sourcePostingId,
            companySlug: job.companySlug,
            category: job.classification.category,
            status: job.status,
            title: job.title,
            contentHash: job.contentHash,
            payload: json(job),
          };

          await transaction.posting.upsert({
            where: { id: job.id },
            create: { id: job.id, ...values },
            update: values,
          });
        }

        for (const job of result.changed) {
          await transaction.postingVersion.create({
            data: {
              postingId: job.id,
              observedAt: new Date(commit.observedAt),
              contentHash: job.contentHash,
              payload: json(job),
            },
          });
        }

        for (const raw of commit.rawResponses) {
          await transaction.snapshot.create({
            data: {
              runId: commit.runId,
              sourceId: commit.source.id,
              url: raw.url,
              fetchedAt: new Date(raw.fetchedAt),
              payload: json(raw.body),
            },
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
