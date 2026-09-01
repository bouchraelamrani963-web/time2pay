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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Instellingen</h1>
        <p className="mt-1 text-sm text-gray-500">Beheer de bedrijfsgegevens die Time2Pay op facturen gebruikt.</p>
      </div>
      <CompanySettingsForm initialValues={initialValues} />
    </div>
  );
}