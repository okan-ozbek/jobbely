CREATE TABLE "CompanyCoverage" (
  "companySlug" TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  CONSTRAINT "CompanyCoverage_pkey" PRIMARY KEY ("companySlug")
);
