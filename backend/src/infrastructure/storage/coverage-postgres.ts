import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import type { CoverageAssessment, CoverageRepository } from '../../ports/coverage.js';

export class PostgresCoverage implements CoverageRepository {
  private readonly client: PrismaClient;

  constructor(
    connectionString: string,
    private readonly configurations: ReadonlyMap<string, string>,
  ) {
    this.client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  async read() {
    const rows = await this.client.companyCoverage.findMany();

    return rows
      .map((row) => row.payload as unknown as CoverageAssessment)
      .filter((row) => this.configurations.get(row.companySlug) === row.configurationHash);
  }

  async save(assessment: CoverageAssessment) {
    // A late older audit cannot overwrite a newer result from another process.
    const payload = JSON.stringify(assessment);

    await this.client.$executeRaw`
      INSERT INTO "CompanyCoverage" ("companySlug", "checkedAt", "payload")
      VALUES (${assessment.companySlug}, ${new Date(assessment.checkedAt)}, ${payload}::jsonb)
      ON CONFLICT ("companySlug") DO UPDATE
      SET "checkedAt" = EXCLUDED."checkedAt", "payload" = EXCLUDED."payload"
      WHERE "CompanyCoverage"."checkedAt" <= EXCLUDED."checkedAt"
    `;
  }

  async close() {
    await this.client.$disconnect();
  }
}
