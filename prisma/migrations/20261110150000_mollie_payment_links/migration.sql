CREATE TABLE "mollie_connections" (
 "userId" TEXT NOT NULL,
 "profileId" TEXT,
 "accessTokenEnc" TEXT NOT NULL,
 "refreshTokenEnc" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "mollie_connections_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "invoice_payment_links" (
 "invoiceId" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "webhookKey" TEXT NOT NULL,
 "paymentLinkId" TEXT,
 "url" TEXT,
 "profileId" TEXT NOT NULL,
 "amountCents" INTEGER NOT NULL,
 "mode" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "invoice_payment_links_pkey" PRIMARY KEY ("invoiceId")
);
CREATE UNIQUE INDEX "invoice_payment_links_webhookKey_key" ON "invoice_payment_links"("webhookKey");
CREATE UNIQUE INDEX "invoice_payment_links_paymentLinkId_key" ON "invoice_payment_links"("paymentLinkId");
CREATE INDEX "invoice_payment_links_userId_idx" ON "invoice_payment_links"("userId");
