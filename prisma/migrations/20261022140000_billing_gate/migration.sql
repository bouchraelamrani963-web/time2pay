ALTER TABLE "invoices" ADD COLUMN "issuedAt" TIMESTAMP(3);
CREATE INDEX "invoices_userId_issuedAt_idx" ON "invoices"("userId", "issuedAt");

CREATE TABLE "billing_accounts" (
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "plan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidThrough" TIMESTAMP(3),
    "issuedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("userId")
);
CREATE UNIQUE INDEX "billing_accounts_stripeCustomerId_key" ON "billing_accounts"("stripeCustomerId");
CREATE UNIQUE INDEX "billing_accounts_stripeSubscriptionId_key" ON "billing_accounts"("stripeSubscriptionId");

CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);
