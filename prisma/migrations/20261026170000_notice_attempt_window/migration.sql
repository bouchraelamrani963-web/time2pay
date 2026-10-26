-- Queue age is distinct from the provider's idempotency/retry window.
ALTER TABLE "security_notices" ADD COLUMN "firstAttemptAt" TIMESTAMP(3);
-- Existing attempted notices retain the previous conservative deadline. Never
-- revive an old ambiguous send beyond its provider idempotency retention.
UPDATE "security_notices" SET "firstAttemptAt" = "createdAt" WHERE "attempts" > 0;
