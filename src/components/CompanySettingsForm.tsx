"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import toast from "react-hot-toast";

export type CompanySettingsFormValues = {
  companyName: string;
  contactName: string;
  street: string;
  postalCode: string;
  city: string;
  kvkNumber: string;
  vatId: string;
  iban: string;
  email: string;
  phone: string;
};

type Props = {
  initialValues: CompanySettingsFormValues;
};

type SaveResponse = Partial<Omit<CompanySettingsFormValues, "phone">> & {
  phone?: string | null;
  error?: unknown;
};

const fields: { name: keyof CompanySettingsFormValues; label: string; type?: string; optional?: boolean }[] = [
  { name: "companyName", label: "Bedrijfsnaam" },
  { name: "contactName", label: "Contactpersoon / naam" },
  { name: "street", label: "Straat + huisnummer" },
  { name: "postalCode", label: "Postcode" },
  { name: "city", label: "Plaats" },
  { name: "kvkNumber", label: "KvK-nummer" },
  { name: "vatId", label: "Btw-id" },
  { name: "iban", label: "IBAN" },
  { name: "email", label: "E-mailadres", type: "email" },
  { name: "phone", label: "Telefoonnummer", type: "tel", optional: true },
];

function getErrorMessage(payload: SaveResponse, status: number) {
  if (status === 401) return "Je sessie is verlopen. Log opnieuw in.";
  if (status === 422) return "Controleer de ingevulde bedrijfsgegevens.";
  return typeof payload.error === "string" ? payload.error : "Bedrijfsgegevens opslaan mislukt.";
}

export default function CompanySettingsForm({ initialValues }: Props) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);

  function setField(name: keyof CompanySettingsFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as SaveResponse;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, response.status));
      }

      setValues({
        companyName: payload.companyName ?? "",
        contactName: payload.contactName ?? "",
        street: payload.street ?? "",
        postalCode: payload.postalCode ?? "",
        city: payload.city ?? "",
        kvkNumber: payload.kvkNumber ?? "",
        vatId: payload.vatId ?? "",
        iban: payload.iban ?? "",
        email: payload.email ?? "",
        phone: payload.phone ?? "",
      });
      toast.success("Bedrijfsgegevens opgeslagen");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bedrijfsgegevens opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6">
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-lg font-bold text-gray-900">Bedrijfsgegevens</h2>
        <p className="mt-1 text-sm text-gray-500">
          Deze gegevens worden gebruikt als afzender en betaalinformatie op nieuwe factuur-PDF's.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.name} className={field.name === "street" ? "sm:col-span-2" : undefined}>
            <label className="label" htmlFor={field.name}>
              {field.label}{field.optional ? " (optioneel)" : ""}
            </label>
            <input
              id={field.name}
              className="input"
              type={field.type ?? "text"}
              value={values[field.name]}
              onChange={(event) => setField(field.name, event.target.value)}
              required={!field.optional}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
        <button type="submit" className="btn-primary" disabled={saving}>
          <Save size={15} /> {saving ? "Opslaan..." : "Bedrijfsgegevens opslaan"}
        </button>
      </div>
    </form>
  );
}
