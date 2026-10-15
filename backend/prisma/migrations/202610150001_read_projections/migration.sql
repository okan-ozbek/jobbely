-- Derived public read models, maintained for old and new writers alike.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Posting"
  ADD COLUMN "missingSince" TEXT,
  ADD COLUMN "url" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "applyUrl" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION jobbely_posting_catalog_metadata() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."locations" := NEW."payload"->'locations';
  NEW."workplace" := NEW."payload"->>'workplace';
  NEW."lastSeenAt" := NEW."payload"->>'lastSeenAt';
  NEW."missingSince" := NEW."payload"->>'missingSince';
  NEW."url" := NEW."payload"->>'url';
  NEW."applyUrl" := NEW."payload"->>'applyUrl';
  NEW."searchText" := lower(concat(NEW."title", ' ', NEW."payload"->>'descriptionText', ' ',
    (SELECT string_agg(value, ' ' ORDER BY ordinal) FROM jsonb_array_elements_text(NEW."payload"->'departments') WITH ORDINALITY d(value, ordinal)), ' ',
    (SELECT string_agg(value, ' ' ORDER BY ordinal) FROM jsonb_array_elements_text(NEW."payload"->'locations') WITH ORDINALITY l(value, ordinal))));
  RETURN NEW;
END;
$$;

UPDATE "Posting" SET "lastSeenAt" = "lastSeenAt";
CREATE INDEX "Posting_active_search_idx" ON "Posting" USING GIN ("searchText" gin_trgm_ops) WHERE "status" = 'active';
CREATE INDEX "Posting_matching_idx" ON "Posting" ("category", "sourceId", "id")
  INCLUDE ("contentHash", "lastSeenAt") WHERE "status" = 'active' AND "missingSince" IS NULL;
CREATE INDEX "Run_completed_source_idx" ON "Run" ("sourceId", ("payload"->>'finishedAt') DESC, "id" DESC) WHERE "status" <> 'running';

-- Ranking needs policy inputs, not full blocks/clauses or display excerpts.
-- Constraint/unparsed excerpts remain: they identify deduplicated criteria.
CREATE FUNCTION jobbely_ranking_requirements(value jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT (value - 'clauses' - 'blocks' - 'warnings' - 'skills' - 'experience') || jsonb_build_object(
    'clauses', '[]'::jsonb, 'warnings', '[]'::jsonb,
    'blocks', COALESCE((SELECT jsonb_agg(block || '{"text":"","headingPath":[]}'::jsonb ORDER BY ordinal)
      FROM jsonb_array_elements(value->'blocks') WITH ORDINALITY b(block, ordinal)), '[]'::jsonb),
    'skills', COALESCE((SELECT jsonb_agg(skill || jsonb_build_object('evidence', (skill->'evidence') || '{"excerpt":""}'::jsonb) ORDER BY ordinal)
      FROM jsonb_array_elements(value->'skills') WITH ORDINALITY s(skill, ordinal)), '[]'::jsonb),
    'experience', COALESCE((SELECT jsonb_agg(experience || jsonb_build_object('evidence', (experience->'evidence') || '{"excerpt":""}'::jsonb) ORDER BY ordinal)
      FROM jsonb_array_elements(value->'experience') WITH ORDINALITY e(experience, ordinal)), '[]'::jsonb)
  );
$$;

ALTER TABLE "JobFeature" ADD COLUMN "ranking" JSONB NOT NULL DEFAULT '{}';
CREATE FUNCTION jobbely_feature_ranking() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."ranking" := jobbely_ranking_requirements(NEW."payload");
  RETURN NEW;
END;
$$;
CREATE TRIGGER jobbely_feature_ranking BEFORE INSERT OR UPDATE ON "JobFeature"
FOR EACH ROW EXECUTE FUNCTION jobbely_feature_ranking();
UPDATE "JobFeature" SET "ranking" = jobbely_ranking_requirements("payload");
COMMIT;
