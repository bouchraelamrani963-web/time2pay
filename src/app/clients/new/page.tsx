"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Save } from "lucide-react";
import toast from "react-hot-toast";

export default function NewClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    vatNumber: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "name" && value.trim()) setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      setError("Naam is verplicht");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ? "Validatie mislukt" : "Aanmaken mislukt");
      }

      const client = await res.json();
      toast.success(`Klant "${client.name}" aangemaakt`);

      if (returnTo === "invoice") {
        router.push(`/invoices/new?clientId=${client.id}`);
      } else {
        router.push("/clients");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={returnTo === "invoice" ? "/invoices/new" : "/clients"}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ChevronLeft size={16} />
          {returnTo === "invoice" ? "Terug naar factuur" : "Terug naar klanten"}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nieuwe klant</h1>
        <p className="text-sm text-gray-500">Voeg een klant toe om facturen aan te maken.</p>
      </div>

      <form onSubmit={onSubmit} className="card p-6 space-y-5 max-w-xl">
        <div>
          <label className="label">
            Naam <span className="text-red-500">*</span>
          </label>
          <input
            className={`input ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""}`}
            placeholder="Jan de Vries Schilderwerk"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            autoFocus
          />
          {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
        </div>

        <div>
          <label className="label">E-mail</label>
          <input
            className="input"
            type="email"
            placeholder="jan@voorbeeld.nl"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Telefoon</label>
            <input
              className="input"
              placeholder="+31 6 12345678"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
            />
          </div>
          <div>
            <label className="label">BTW-nummer</label>
            <input
              className="input font-mono"
              placeholder="NL123456789B01"
              value={form.vatNumber}
              onChange={(e) => setField("vatNumber", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Adres</label>
          <textarea
            className="input h-20 resize-none"
            placeholder="Straat 1&#10;1234 AB Stad"
            value={form.address}
            onChange={(e) => setField("address", e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-5">
          <Link
            href={returnTo === "invoice" ? "/invoices/new" : "/clients"}
            className="btn-secondary"
          >
            Annuleren
          </Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save size={15} />
            {saving ? "Opslaan..." : "Klant aanmaken"}
          </button>
        </div>
      </form>
    </div>
  );
}
