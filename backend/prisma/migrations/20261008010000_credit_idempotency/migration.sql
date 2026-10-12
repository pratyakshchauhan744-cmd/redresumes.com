CREATE TABLE "CreditIdempotencyRecord" (
  "id" TEXT NOT NULL,
  "collegeId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "key" VARCHAR(36) NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "responseStatus" INTEGER,
  "responseBody" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CreditIdempotencyRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CreditIdempotencyRecord_status_check" CHECK (
    ("status" = 'PROCESSING' AND "completedAt" IS NULL AND "responseStatus" IS NULL AND "responseBody" IS NULL)
    OR ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "responseStatus" = 200 AND "responseBody" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "CreditIdempotencyRecord_collegeId_actorId_operation_key_key"
ON "CreditIdempotencyRecord"("collegeId", "actorId", "operation", "key");
