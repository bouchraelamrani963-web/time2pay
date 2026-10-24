-- Additive: preserve existing customer data, prices and historical invoices.
ALTER TABLE "clients" ADD COLUMN "shiftRates" JSONB;
ALTER TABLE "clients" ADD COLUMN "ortAgreed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN "ortAgreed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoice_items" ADD COLUMN "serviceType" TEXT;
-- Existing ORT is a historical snapshot, not permission for future invoices.
UPDATE "invoices" SET "ortAgreed" = true WHERE EXISTS (
  SELECT 1 FROM "invoice_items" WHERE "invoice_items"."invoiceId" = "invoices"."id" AND "ortPerc" > 0
);
