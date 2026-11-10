BEGIN;

-- CreateEnum
CREATE TYPE "BusinessTeamRole" AS ENUM ('ADMINISTRATION', 'EMPLOYEE');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "companyId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "businessSentAt" TIMESTAMP(3),
ADD COLUMN     "clientSnapshot" JSONB,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "createdByUid" TEXT,
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "issuerSnapshot" JSONB,
ALTER COLUMN "userId" DROP NOT NULL;

-- Keep personal numbers unique and allow independent company sequences.
CREATE UNIQUE INDEX "invoices_personal_number_key" ON "invoices"("number") WHERE "companyId" IS NULL;
DROP INDEX "invoices_number_key";

-- CreateTable
CREATE TABLE "business_companies" (
    "id" TEXT NOT NULL,
    "ownerUid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'F',
    "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1,
    "invoiceTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_seats" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "role" "BusinessTeamRole" NOT NULL,
    "userUid" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_audit_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorUid" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_companies_ownerUid_key" ON "business_companies"("ownerUid");

-- CreateIndex
CREATE INDEX "business_seats_userUid_idx" ON "business_seats"("userUid");

-- CreateIndex
CREATE INDEX "business_seats_email_idx" ON "business_seats"("email");

-- CreateIndex
CREATE UNIQUE INDEX "business_seats_companyId_slot_key" ON "business_seats"("companyId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "business_seats_companyId_email_key" ON "business_seats"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "business_seats_companyId_userUid_key" ON "business_seats"("companyId", "userUid");

-- CreateIndex
CREATE INDEX "business_audit_events_companyId_createdAt_idx" ON "business_audit_events"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "clients_companyId_idx" ON "clients"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "clients_id_companyId_key" ON "clients"("id", "companyId");

-- CreateIndex
CREATE INDEX "invoices_companyId_createdByUid_status_idx" ON "invoices"("companyId", "createdByUid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_companyId_number_key" ON "invoices"("companyId", "number");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "business_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "business_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_companyId_fkey" FOREIGN KEY ("clientId", "companyId") REFERENCES "clients"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_seats" ADD CONSTRAINT "business_seats_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "business_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_audit_events" ADD CONSTRAINT "business_audit_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "business_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_seats"
  ADD CONSTRAINT "business_seats_slot_range" CHECK ("slot" BETWEEN 2 AND 5),
  ADD CONSTRAINT "business_seats_member_or_invite" CHECK (("userUid" IS NULL) <> ("expiresAt" IS NULL)),
  ADD CONSTRAINT "business_seats_email_normalized" CHECK ("email" = lower("email"));

ALTER TABLE "clients" ADD CONSTRAINT "clients_single_scope"
  CHECK (("userId" IS NULL) <> ("companyId" IS NULL));
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_single_scope"
  CHECK (("userId" IS NOT NULL AND "companyId" IS NULL AND "createdByUid" IS NULL) OR
         ("userId" IS NULL AND "companyId" IS NOT NULL AND "createdByUid" IS NOT NULL));
ALTER TABLE "invoices" ADD CONSTRAINT "business_invoice_snapshot_required"
  CHECK ("companyId" IS NULL OR
         ("status" = 'DRAFT' AND "finalizedAt" IS NULL AND "issuerSnapshot" IS NULL AND "clientSnapshot" IS NULL) OR
         ("status" <> 'DRAFT' AND "finalizedAt" IS NOT NULL AND "issuerSnapshot" IS NOT NULL AND "clientSnapshot" IS NOT NULL));

COMMIT;
