import { randomUUID } from "node:crypto";
import type { Dataset, Source } from "../../domain/model.js";
import type { JobRepository, SnapshotCommit } from "../../ports/ingestion.js";
import { applySnapshot } from "./snapshot.js";
export class MemoryJobRepository implements JobRepository {
  private dataset: Dataset = { version: 0, jobs: [], runs: [] };
  async read() {
    return structuredClone(this.dataset);
  }
  async startRun(source: Source, at: string) {
    if (
      this.dataset.runs.some(
        (run) => run.sourceId === source.id && run.status === "running",
      )
    )
      return null;
    const run = {
      id: randomUUID(),
      sourceId: source.id,
      startedAt: at,
      finishedAt: null,
      status: "running" as const,
      listingCount: 0,
      excludedCount: 0,
      enumerationComplete: false,
      removalsQuarantined: false,
      error: null,
    };
    this.dataset.runs.push(run);
    return structuredClone(run);
  }
  async commitSnapshot(commit: SnapshotCommit) {
    const result = applySnapshot(this.dataset, commit);
    this.dataset = result.dataset;
    return structuredClone(result.run);
  }
  async failRun(runId: string, at: string, error: string) {
    this.dataset.runs = this.dataset.runs.map((run) =>
      run.id === runId && run.status === "running"
        ? { ...run, status: "failed", finishedAt: at, error }
        : run,
    );
  }
  async ping() {}
  async close() {}
}
