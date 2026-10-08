-- Keep frequently-read catalog metadata separate from the large posting payload.
BEGIN;

ALTER TABLE "Posting"
  ADD COLUMN "locations" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "workplace" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "lastSeenAt" TEXT NOT NULL DEFAULT '';

UPDATE "Posting" SET
  "locations" = "payload"->'locations',
  "workplace" = "payload"->>'workplace',
  "lastSeenAt" = "payload"->>'lastSeenAt';

-- Derive these fields atomically from the canonical record, including writes
-- from an older worker during a rolling deployment. Do not alter its timestamps.
CREATE FUNCTION jobbely_posting_catalog_metadata() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."locations" := NEW."payload"->'locations';
  NEW."workplace" := NEW."payload"->>'workplace';
  NEW."lastSeenAt" := NEW."payload"->>'lastSeenAt';
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobbely_posting_catalog_metadata
BEFORE INSERT OR UPDATE ON "Posting"
FOR EACH ROW EXECUTE FUNCTION jobbely_posting_catalog_metadata();

COMMIT;
