ALTER TABLE "AccountUser" ADD COLUMN "username" TEXT;
CREATE TABLE "PasswordCredential" (
  "email" TEXT PRIMARY KEY, "userId" TEXT NOT NULL UNIQUE REFERENCES "AccountUser"("id"),
  "passwordHash" TEXT NOT NULL, "verifiedAt" TIMESTAMP(3) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "EmailChallenge" (
  "tokenHash" TEXT PRIMARY KEY, "browserHash" TEXT NOT NULL, "email" TEXT NOT NULL,
  "purpose" TEXT NOT NULL CHECK ("purpose" IN ('register','reset')), "codeHash" TEXT NOT NULL,
  "passwordHash" TEXT, "username" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
  "sends" INTEGER NOT NULL DEFAULT 1 CHECK ("sends" >= 1), "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "consumedAt" TIMESTAMP(3),
  CHECK (("purpose" = 'register' AND ("passwordHash" IS NOT NULL OR "consumedAt" IS NOT NULL)) OR "purpose" = 'reset')
);
CREATE INDEX "EmailChallenge_email_purpose_idx" ON "EmailChallenge"("email","purpose");
CREATE INDEX "EmailChallenge_expiresAt_idx" ON "EmailChallenge"("expiresAt");
CREATE TABLE "CredentialRateWindow" ("key" TEXT PRIMARY KEY, "count" INTEGER NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "CredentialRateWindow_expiresAt_idx" ON "CredentialRateWindow"("expiresAt");
CREATE TABLE "AccountEmailJob" (
  "id" TEXT PRIMARY KEY, "challengeHash" TEXT NOT NULL, "codeHash" TEXT NOT NULL, "sealedEmail" TEXT,
  "state" TEXT NOT NULL DEFAULT 'queued' CHECK ("state" IN ('queued','leased','sent','failed','canceled')),
  "attempts" INTEGER NOT NULL DEFAULT 0, "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AccountEmailJob_state_availableAt_idx" ON "AccountEmailJob"("state","availableAt");
CREATE INDEX "AccountEmailJob_challengeHash_idx" ON "AccountEmailJob"("challengeHash");
CREATE INDEX "AccountEmailJob_expiresAt_idx" ON "AccountEmailJob"("expiresAt");
