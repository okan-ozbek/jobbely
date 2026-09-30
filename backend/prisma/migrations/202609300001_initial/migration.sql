-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "DatasetVersion" (
    "id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DatasetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceLease" (
    "sourceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceLease_pkey" PRIMARY KEY ("sourceId")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Posting" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourcePostingId" TEXT NOT NULL,
    "companySlug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "Posting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostingVersion" (
    "id" TEXT NOT NULL,
    "postingId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "PostingVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Run_sourceId_status_idx" ON "Run"("sourceId", "status");

-- CreateIndex
CREATE INDEX "Posting_companySlug_category_status_idx" ON "Posting"("companySlug", "category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Posting_sourceId_sourcePostingId_key" ON "Posting"("sourceId", "sourcePostingId");

-- CreateIndex
CREATE INDEX "PostingVersion_postingId_observedAt_idx" ON "PostingVersion"("postingId", "observedAt");

-- CreateIndex
CREATE INDEX "Snapshot_sourceId_fetchedAt_idx" ON "Snapshot"("sourceId", "fetchedAt");

-- AddForeignKey
ALTER TABLE "PostingVersion" ADD CONSTRAINT "PostingVersion_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "Posting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
