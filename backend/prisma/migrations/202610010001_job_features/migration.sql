ALTER TABLE "DatasetVersion" ADD COLUMN "featureGeneration" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "JobFeature" (
  "postingId" TEXT PRIMARY KEY REFERENCES "Posting"("id") ON DELETE CASCADE,
  "contentHash" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "skillIds" TEXT[] NOT NULL,
  "payload" JSONB NOT NULL
);
CREATE INDEX "JobFeature_version_category_postingId_idx" ON "JobFeature"("version", "category", "postingId");
CREATE INDEX "JobFeature_skillIds_gin" ON "JobFeature" USING GIN ("skillIds");
CREATE INDEX "Posting_status_category_sourceId_id_idx" ON "Posting"("status", "category", "sourceId", "id");
