-- Additive only. Do not run on Production before a verified database backup.
CREATE TABLE IF NOT EXISTS "billing_accounts" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "customerId" TEXT,
  "subscriptionId" TEXT,
  "freeInvoiceUsed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_accounts_customerId_key" ON "billing_accounts"("customerId");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_accounts_subscriptionId_key" ON "billing_accounts"("subscriptionId");
CREATE TABLE "invoice_issues" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "periodStart" INTEGER NOT NULL,
  "periodEnd" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "invoice_issues_userId_invoiceId_key" ON "invoice_issues"("userId", "invoiceId");
CREATE INDEX "invoice_issues_userId_subscriptionId_periodStart_idx" ON "invoice_issues"("userId", "subscriptionId", "periodStart");
