-- Public host pacing shared by all ingestion replicas; no candidate data.
CREATE TABLE "HttpHostBudget" (
  "host" TEXT PRIMARY KEY,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  "blockedUntil" TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  "intervalMs" INTEGER NOT NULL DEFAULT 1000 CHECK ("intervalMs" >= 0)
);
