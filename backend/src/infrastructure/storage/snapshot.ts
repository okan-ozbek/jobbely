import { randomUUID } from "node:crypto";
import type { Dataset, Job, SourceRun } from "../../domain/model.js";
import { markMissing, shouldQuarantine } from "../../domain/lifecycle.js";
import type { SnapshotCommit } from "../../ports/ingestion.js";

export function applySnapshot(
  dataset: Dataset,
  commit: SnapshotCommit,
): { dataset: Dataset; run: SourceRun; changed: Job[] } {
  const previousRun = dataset.runs.find((run) => run.id === commit.runId);
  if (!previousRun || previousRun.status !== "running")
    throw new Error("Run no longer owns this snapshot");
  const jobs = new Map(dataset.jobs.map((job) => [job.id, job]));
  const previous = dataset.jobs.filter(
    (job) => job.sourceId === commit.source.id,
  );
  const bySourceId = new Map(previous.map((job) => [job.sourcePostingId, job]));
  const previousBaseline = dataset.runs
    .filter(
      (run) =>
        run.sourceId === commit.source.id &&
        run.status === "succeeded" &&
        run.enumerationComplete &&
        !run.removalsQuarantined,
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const quarantine = shouldQuarantine(
    previousBaseline?.listingCount ?? 0,
    commit.postings.length,
  );
  const changed: Job[] = [];
  const seen = new Set<string>();
  for (const posting of commit.postings) {
    if (seen.has(posting.sourcePostingId))
      throw new Error("Duplicate snapshot IDs");
    seen.add(posting.sourcePostingId);
    const existing = bySourceId.get(posting.sourcePostingId);
    const job: Job = {
      ...posting,
      id: existing?.id ?? randomUUID(),
      sourceId: commit.source.id,
      companySlug: commit.source.companySlug,
      status: "active",
      firstSeenAt: existing?.firstSeenAt ?? commit.observedAt,
      lastSeenAt: commit.observedAt,
      missingSince: null,
      missingCount: 0,
      lastMissingAt: null,
      closedAt: null,
    };
    jobs.set(job.id, job);
    if (!existing || existing.contentHash !== job.contentHash)
      changed.push(job);
  }
  if (
    commit.enumerationComplete &&
    commit.source.auditStatus === "verified" &&
    !quarantine
  ) {
    for (const job of previous)
      if (!seen.has(job.sourcePostingId))
        jobs.set(job.id, markMissing(job, commit.observedAt));
  }
  const run: SourceRun = {
    ...previousRun,
    finishedAt: commit.observedAt,
    status: "succeeded",
    listingCount: commit.postings.length,
    excludedCount: commit.excluded,
    enumerationComplete: commit.enumerationComplete,
    removalsQuarantined: quarantine,
    error: null,
  };
  return {
    dataset: {
      version: dataset.version + 1,
      jobs: [...jobs.values()],
      runs: dataset.runs.map((item) => (item.id === run.id ? run : item)),
    },
    run,
    changed,
  };
}
