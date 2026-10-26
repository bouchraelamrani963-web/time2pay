-- Complete fresh installations from the existing public CompanySettings model.
-- Existing installations retain their table and rows. Schema drift must still
-- be checked separately; IF NOT EXISTS is not a schema reconciliation.
CREATE TABLE IF NOT EXISTS "company_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "kvkNumber" TEXT NOT NULL,
    "vatId" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "company_settings_userId_key" ON "company_settings"("userId");
