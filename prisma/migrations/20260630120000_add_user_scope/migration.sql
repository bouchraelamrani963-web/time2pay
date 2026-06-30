ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "clients_userId_idx" ON "clients"("userId");
CREATE INDEX IF NOT EXISTS "invoices_userId_idx" ON "invoices"("userId");
