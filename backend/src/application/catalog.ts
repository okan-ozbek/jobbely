import { createHash } from "node:crypto";
import type { Company, Dataset, Job, Source } from "../domain/model.js";
import type { JobRepository } from "../ports/ingestion.js";

/**
 * This interface defines the structure of a job query used to filter and paginate job listings.
 */
export interface JobQuery 
{
  q?: string;
  company?: string;
  category?: string;
  workplace?: string;
  cursor?: string;
  limit?: number;
}

/**
 * This class represents an error that occurs during job query processing.
 * 
 * @class QueryError
 * @classdesc Represents an error that occurs during job query processing.
 * @extends Error The base class for all errors in JavaScript.
 */
export class QueryError extends Error 
{
  constructor(
    public readonly code: "invalid_cursor" | "cursor_stale",
    message: string,
  ) 
  {
    super(message);
  }
}

/**
 * Checks if a job matches the given query.
 * 
 * @param job The job to check.
 * @param query The query to match against.
 * @returns True if the job matches the query, false otherwise.
 */
const matches = (job: Job, query: JobQuery) =>
  job.status === "active" &&
  (
    !query.q ||
    `${job.title} ${job.descriptionText} ${job.departments.join(" ")} ${job.locations.join(" ")}`
      .toLowerCase()
      .includes(query.q.toLowerCase())
  ) &&
  (!query.company || query.company.split(",").includes(job.companySlug)) &&
  (
    !query.category ||
    query.category.split(",").includes(job.classification.category)
  ) &&
  (!query.workplace || query.workplace.split(",").includes(job.workplace));

/**
 * Compares two jobs for ordering based on their last seen date and ID.
 * 
 * @param a The first job to compare.
 * @param b The second job to compare.
 * @returns A negative number if a should come before b, a positive number if a should come after b, or 0 if they are equal.
 */
const order = (a: Job, b: Job) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.id.localeCompare(b.id);

/**
 * Represents a catalog of jobs that can be queried and paginated.
 * 
 * @class JobCatalog
 * @classdesc Represents a catalog of jobs that can be queried and paginated. 
 */
export class JobCatalog 
{
  constructor(
    private readonly repository: JobRepository,
    private readonly companies: Company[],
    private readonly sources: Source[],
    private readonly mode: "demo" | "postgres",
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async jobs(query: JobQuery) 
  {
    const dataset = await this.repository.read();

    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          query.q ?? "",
          query.company ?? "",
          query.category ?? "",
          query.workplace ?? "",
        ]),
      )
      .digest("hex");

    const filtered = dataset.jobs
      .filter((job) => matches(job, query))
      .sort(order);

    let start = 0;

    if (query.cursor) {
      let cursor: { version: number; fingerprint: string; id: string };

      try {
        const value: unknown = JSON.parse(
          Buffer.from(query.cursor, "base64url").toString("utf8"),
        );

        if (
          !value ||
          typeof value !== "object" ||
          !("version" in value) ||
          !("fingerprint" in value) ||
          !("id" in value) ||
          typeof value.version !== "number" ||
          typeof value.fingerprint !== "string" ||
          typeof value.id !== "string"
        ) {
          throw new Error();
        }
          
        cursor = value as typeof cursor;
      } 
      catch {
        throw new QueryError("invalid_cursor", "Invalid pagination cursor");
      }

      if (cursor.fingerprint !== fingerprint) {
        throw new QueryError(
          "invalid_cursor",
          "Cursor belongs to different filters",
        );
      }

      if (cursor.version !== dataset.version) {
        throw new QueryError(
          "cursor_stale",
          "Listings changed; restart pagination",
        );
      }

      start = filtered.findIndex((job) => job.id === cursor.id) + 1;

      if (!start) {
        throw new QueryError(
          "invalid_cursor",
          "Cursor posting is not in this result",
        );
      }
    }
    const items = filtered.slice(start, start + (query.limit ?? 20));
    const last = items.at(-1);
    const nextCursor =
      last && start + items.length < filtered.length
        ? Buffer.from(
            JSON.stringify({
              version: dataset.version,
              fingerprint,
              id: last.id,
            }),
          ).toString("base64url")
        : null;
    return {
      items,
      total: filtered.length,
      nextCursor,
      datasetVersion: dataset.version,
      mode: this.mode,
    };
  }

  async job(id: string) 
  {
    return (await this.repository.read()).jobs.find((job) => job.id === id);
  }
  async facets(query: JobQuery) {
    const jobs = (await this.repository.read()).jobs.filter((job) =>
      matches(job, query),
    );
    const count = (values: string[]) =>
      [...new Set(values)].map((value) => ({
        value,
        count: values.filter((item) => item === value).length,
      }));
    return {
      companies: count(jobs.map((job) => job.companySlug)),
      categories: count(jobs.map((job) => job.classification.category)),
      workplaces: count(jobs.map((job) => job.workplace)),
    };
  }
  async coverage() {
    const dataset = await this.repository.read();
    return this.companies.map((company) =>
      this.companyCoverage(company, dataset),
    );
  }
  private companyCoverage(company: Company, dataset: Dataset) {
    const sources = this.sources.filter(
      (source) => source.companySlug === company.slug,
    );
    const latestRuns = sources.map(
      (source) =>
        dataset.runs
          .filter((run) => run.sourceId === source.id)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0],
    );
    const lastSuccess = sources.map(
      (source) =>
        dataset.runs
          .filter(
            (run) =>
              run.sourceId === source.id &&
              run.status === "succeeded" &&
              run.enumerationComplete,
          )
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
          ?.finishedAt ?? null,
    );
    let status:
      "not_onboarded" | "partial" | "stale" | "blocked" | "healthy" | "demo" =
      "not_onboarded";
    if (sources.length) {
      status = "partial";
      if (latestRuns.some((run) => run?.status === "failed"))
        status = "blocked";
      else if (
        lastSuccess.some(
          (date) =>
            date &&
            this.clock().getTime() - Date.parse(date) > 36 * 60 * 60_000,
        )
      )
        status = "stale";
      else if (
        sources.every((source) => source.auditStatus === "verified") &&
        latestRuns.every(
          (run) =>
            run?.status === "succeeded" &&
            run.enumerationComplete &&
            !run.removalsQuarantined,
        )
      )
        status = "healthy";
    }
    if (this.mode === "demo" && sources.length) status = "demo";
    return {
      ...company,
      status,
      jobs: dataset.jobs.filter(
        (job) => job.companySlug === company.slug && job.status === "active",
      ).length,
      lastCheckedAt:
        lastSuccess.every(Boolean) && lastSuccess.length
          ? ([...lastSuccess].sort()[0] ?? null)
          : null,
      sources: sources.map((source, index) => ({
        id: source.id,
        provider: source.provider,
        auditStatus: source.auditStatus,
        scheduled: source.scheduled,
        lastRunStatus: latestRuns[index]?.status ?? null,
      })),
    };
  }
}
