-- Additive only. Rehearse on isolated Preview after a restorable backup.
-- Never delete these records while a recovery is active.
CREATE TABLE "account_recovery" ("userId" TEXT PRIMARY KEY, "status" TEXT NOT NULL DEFAULT 'NONE',
 "codesIssuedAt" TIMESTAMP(3), "grantHash" TEXT, "startedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3),
 "oldFactors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "account_recovery_grantHash_key" ON "account_recovery"("grantHash");
CREATE TABLE "recovery_codes" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "codeHash" TEXT NOT NULL,
 "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "recovery_codes_userId_codeHash_key" ON "recovery_codes"("userId","codeHash");
CREATE INDEX "recovery_codes_userId_idx" ON "recovery_codes"("userId");
CREATE TABLE "security_rate_buckets" ("key" TEXT PRIMARY KEY, "attempts" INTEGER NOT NULL DEFAULT 0,
 "windowStart" TIMESTAMP(3) NOT NULL, "blockedUntil" TIMESTAMP(3));
CREATE TABLE "security_events" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "security_events_userId_createdAt_idx" ON "security_events"("userId","createdAt");
CREATE TABLE "security_notices" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "email" TEXT NOT NULL,
 "kind" TEXT NOT NULL, "sentAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "security_notices_sentAt_createdAt_idx" ON "security_notices"("sentAt","createdAt");
CREATE TABLE "recovery_support_requests" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "contactEmail" TEXT NOT NULL,
 "description" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "recovery_support_requests_userId_createdAt_idx" ON "recovery_support_requests"("userId","createdAt");
