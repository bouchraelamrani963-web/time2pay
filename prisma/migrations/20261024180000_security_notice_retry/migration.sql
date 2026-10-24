-- Additive only. Existing notices remain pending and existing business data is untouched.
ALTER TABLE "security_notices"
 ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "leaseToken" TEXT,
 ADD COLUMN "leaseUntil" TIMESTAMP(3),
 ADD COLUMN "failedAt" TIMESTAMP(3),
 ADD COLUMN "lastErrorCode" TEXT,
 ADD COLUMN "providerId" TEXT,
 ADD COLUMN "workflowRunId" TEXT,
 ADD COLUMN "dispatchLeaseUntil" TIMESTAMP(3);
CREATE INDEX "security_notices_sentAt_failedAt_nextAttemptAt_idx"
 ON "security_notices"("sentAt", "failedAt", "nextAttemptAt");
