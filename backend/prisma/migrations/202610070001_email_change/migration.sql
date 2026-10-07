ALTER TABLE "EmailChallenge" ADD COLUMN IF NOT EXISTS "userId" TEXT, ADD COLUMN IF NOT EXISTS "previousEmail" TEXT;
CREATE INDEX IF NOT EXISTS "EmailChallenge_userId_idx" ON "EmailChallenge"("userId");
ALTER TABLE "EmailChallenge" DROP CONSTRAINT "EmailChallenge_purpose_check", DROP CONSTRAINT "EmailChallenge_check";
ALTER TABLE "EmailChallenge" ADD CONSTRAINT "EmailChallenge_purpose_check" CHECK ("purpose" IN ('register', 'reset', 'change-email'));
ALTER TABLE "EmailChallenge" ADD CONSTRAINT "EmailChallenge_check" CHECK (
  ("purpose" = 'register' AND ("passwordHash" IS NOT NULL OR "consumedAt" IS NOT NULL))
  OR "purpose" = 'reset'
  OR ("purpose" = 'change-email' AND "userId" IS NOT NULL AND "previousEmail" IS NOT NULL AND ("passwordHash" IS NOT NULL OR "consumedAt" IS NOT NULL))
);
