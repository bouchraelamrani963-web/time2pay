-- Additive only. Do not apply until the isolated Preview migration is approved.
CREATE TABLE "billing_webhook_events" (
 "accountId" TEXT NOT NULL, "eventId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
 "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("accountId", "eventId")
);
CREATE TABLE "billing_notices" (
 "id" TEXT NOT NULL, "key" TEXT NOT NULL, "userId" TEXT NOT NULL,
 "customerId" TEXT NOT NULL, "subscriptionId" TEXT NOT NULL,
 "invoiceId" TEXT NOT NULL, "kind" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "sentAt" TIMESTAMP(3), "suppressedAt" TIMESTAMP(3), "failedAt" TIMESTAMP(3),
 "attempts" INTEGER NOT NULL DEFAULT 0, "firstAttemptAt" TIMESTAMP(3),
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3), "lastErrorCode" TEXT,
 "providerId" TEXT, "workflowRunId" TEXT, "dispatchLeaseUntil" TIMESTAMP(3),
 CONSTRAINT "billing_notices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_notices_key_key" ON "billing_notices"("key");
CREATE INDEX "billing_notices_sentAt_failedAt_suppressedAt_nextAttemptAt_idx"
 ON "billing_notices"("sentAt", "failedAt", "suppressedAt", "nextAttemptAt");
