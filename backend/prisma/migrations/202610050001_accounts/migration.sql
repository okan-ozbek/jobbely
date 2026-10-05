CREATE TABLE "AccountUser" (
  "id" TEXT PRIMARY KEY,
  "state" TEXT NOT NULL DEFAULT 'active' CHECK ("state" IN ('active', 'disabled', 'deleted')),
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "AccountIdentity" (
  "id" TEXT PRIMARY KEY,
  "issuer" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('github', 'linkedin')),
  "userId" TEXT NOT NULL REFERENCES "AccountUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountIdentity_issuer_subject_key" ON "AccountIdentity"("issuer", "subject");
CREATE INDEX "AccountIdentity_userId_idx" ON "AccountIdentity"("userId");

CREATE TABLE "ApplicationSession" (
  "tokenHash" TEXT PRIMARY KEY,
  "csrfToken" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "AccountUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idleExpiresAt" TIMESTAMP(3) NOT NULL,
  "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CHECK ("idleExpiresAt" <= "absoluteExpiresAt")
);
CREATE INDEX "ApplicationSession_userId_idx" ON "ApplicationSession"("userId");
CREATE INDEX "ApplicationSession_absoluteExpiresAt_idx" ON "ApplicationSession"("absoluteExpiresAt");

CREATE TABLE "OAuthAttempt" (
  "stateHash" TEXT PRIMARY KEY,
  "browserHash" TEXT NOT NULL,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('github', 'linkedin')),
  "verifier" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "OAuthAttempt_expiresAt_idx" ON "OAuthAttempt"("expiresAt");
