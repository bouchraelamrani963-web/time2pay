import Link from "next/link";
import { getMfaConfiguration } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import CompanySettingsForm, { type CompanySettingsFormValues } from "@/components/CompanySettingsForm";

function emptySettings(): CompanySettingsFormValues {
  return {
    companyName: "",
    contactName: "",
    street: "",
    postalCode: "",
    city: "",
    kvkNumber: "",
    vatId: "",
    iban: "",
    email: "",
    phone: "",
  };
}

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await prisma.companySettings.findUnique({
    where: { userId: user.uid },
  });

  const initialValues: CompanySettingsFormValues = settings
    ? {
        companyName: settings.companyName,
        contactName: settings.contactName,
        street: settings.street,
        postalCode: settings.postalCode,
        city: settings.city,
        kvkNumber: settings.kvkNumber,
        vatId: settings.vatId,
        iban: settings.iban,
        email: settings.email,
        phone: settings.phone ?? "",
      }
    : emptySettings();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[#33243b]">Instellingen</h1>
        <p className="mt-1 text-sm text-[#726671]">Beheer de bedrijfsgegevens die Time2Pay op facturen gebruikt.</p>
      </div>
      <section className="rounded-lg border border-[#eadfda] bg-white p-6 space-y-3" aria-labelledby="security-heading">
        <h2 id="security-heading" className="text-xl font-semibold">Inlogbeveiliging</h2>
        <p className="text-sm text-[#726671]">Met een authenticator-app bevestig je het inloggen met een extra code.</p>
        {getMfaConfiguration().setupEnabled ? (
          <Link href="/login?security=setup" className="inline-block font-semibold text-[#543749] underline">Authenticator instellen</Link>
        ) : <p className="text-sm text-[#726671]">Deze extra beveiliging wordt voorbereid en is nog niet beschikbaar om te koppelen.</p>}
      </section>
      <CompanySettingsForm initialValues={initialValues} />
    </div>
  );
}