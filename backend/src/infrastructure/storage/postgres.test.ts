import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { PostgresJobRepository } from "./postgres.js";
import type { NormalizedPosting, Source } from "../../domain/model.js";
const connectionString = process.env["TEST_DATABASE_URL"];
const integration = connectionString ? describe : describe.skip;
integration("PostgreSQL transactions (isolated test database)", () => {
  let repository: PostgresJobRepository;
  let secondRepository: PostgresJobRepository;
  beforeAll(async () => {
    if (
      !connectionString ||
      !/^\/jobbely_test_[a-z0-9_]+$/.test(new URL(connectionString).pathname)
    )
      throw new Error(
        "Integration tests require a dedicated jobbely_test_* database",
      );
    const client = new pg.Client({ connectionString });
    await client.connect();
    const existing = await client.query(
      `SELECT to_regclass('"DatasetVersion"') AS table`,
    );
    if (!existing.rows[0]?.table)
      await client.query(
        await readFile(
          new URL(
            "../../../prisma/migrations/202609300001_initial/migration.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
    await client.end();
    repository = new PostgresJobRepository(connectionString);
    secondRepository = new PostgresJobRepository(connectionString);
  });
  afterAll(async () => {
    await repository?.close();
    await secondRepository?.close();
  });
  const source = (): Source => ({
    id: randomUUID(),
    companySlug: "test",
    provider: "greenhouse",
    board: "test",
    auditStatus: "verified",
    scheduled: false,
  });
  const posting = (id: string): NormalizedPosting => ({
    sourcePostingId: id,
    title: "Engineer",
    url: "https://example.com/job",
    applyUrl: "https://example.com/apply",
    descriptionHtml: "<p>Description</p>",
    descriptionText: "Description",
    departments: ["Engineering"],
    locations: ["Amsterdam"],
    workplace: "unknown",
    employment: "unknown",
    publishedAt: null,
    classification: {
      category: "engineering",
      method: "source_mapping",
      rule: "label:engineering",
      evidence: "Engineering",
      version: "1",
    },
    contentHash: "unchanged",
  });
  it("grants one lease across independent clients", async () => {
    const item = source();
    const at = new Date().toISOString();
    const claims = await Promise.all([
      repository.startRun(item, at),
      secondRepository.startRun(item, at),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    await repository.failRun(claims.find(Boolean)!.id, at, "test cleanup");
  });
  it("rolls back the whole snapshot on duplicate IDs, including version publication", async () => {
    const item = source();
    const at = new Date().toISOString();
    const run = await repository.startRun(item, at);
    const version = (await repository.read()).version;
    await expect(
      repository.commitSnapshot({
        source: item,
        runId: run!.id,
        observedAt: at,
        postings: [posting("1"), posting("1")],
        rawResponses: [],
        excluded: 0,
        enumerationComplete: true,
      }),
    ).rejects.toThrow("Duplicate");
    const after = await secondRepository.read();
    expect(after.version).toBe(version);
    expect(after.jobs.some((job) => job.sourceId === item.id)).toBe(false);
    await repository.failRun(run!.id, at, "test cleanup");
  });
  it("persists stable identity and missing observations across independent repository instances", async () => {
    const item = source();
    async function commit(at: string, ids: string[]) {
      const run = await repository.startRun(item, at);
      return repository.commitSnapshot({
        source: item,
        runId: run!.id,
        observedAt: at,
        postings: ids.map(posting),
        rawResponses: [
          { url: "https://example.com/feed", fetchedAt: at, body: { ids } },
        ],
        excluded: 0,
        enumerationComplete: true,
      });
    }
    await commit("2026-09-30T12:00:00.000Z", ["1", "2", "3", "4"]);
    const original = (await secondRepository.read()).jobs.find(
      (job) => job.sourceId === item.id && job.sourcePostingId === "4",
    )!;
    await commit("2026-10-01T12:00:00.000Z", ["1", "2", "3"]);
    await commit("2026-10-02T12:00:00.000Z", ["1", "2", "3"]);
    expect(
      (await secondRepository.read()).jobs.find(
        (job) => job.id === original.id,
      ),
    ).toMatchObject({ status: "closed", missingCount: 2 });
    await commit("2026-10-02T13:00:00.000Z", ["1", "2", "3", "4"]);
    expect(
      (await secondRepository.read()).jobs.find(
        (job) => job.id === original.id,
      ),
    ).toMatchObject({ status: "active", firstSeenAt: original.firstSeenAt });
  });
  it("rolls back postings already written when raw evidence persistence fails", async () => {
    const item = source();
    const at = new Date().toISOString();
    const run = await repository.startRun(item, at);
    const version = (await repository.read()).version;
    await expect(
      repository.commitSnapshot({
        source: item,
        runId: run!.id,
        observedAt: at,
        postings: [posting("1")],
        rawResponses: [
          {
            url: "https://example.com/feed",
            fetchedAt: "invalid date",
            body: {},
          },
        ],
        excluded: 0,
        enumerationComplete: true,
      }),
    ).rejects.toThrow();
    const after = await secondRepository.read();
    expect(after.version).toBe(version);
    expect(after.jobs.some((job) => job.sourceId === item.id)).toBe(false);
    expect(after.runs.find((row) => row.id === run!.id)?.status).toBe(
      "running",
    );
    await repository.failRun(run!.id, at, "test cleanup");
  });
});
