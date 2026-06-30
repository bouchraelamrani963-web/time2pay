"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import toast from "react-hot-toast";

type ClientErrorPayload = {
  error?: unknown;
  message?: unknown;
};

function toErrorText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value) && value.length > 0) return "Controleer de ingevulde klantgegevens.";
  return null;
}

function getClientCreateError(status: number, payload: ClientErrorPayload): string {
  const message = toErrorText(payload.message) ?? toErrorText(payload.error);
  if (message) return message;
  if (status === 401) return "Je sessie is verlopen. Log opnieuw in.";
  if (status === 422) return "Controleer de ingevulde klantgegevens.";
  return "Klant aanmaken mislukt. Probeer het opnieuw.";
}

async function readErrorPayload(response: Response): Promise<ClientErrorPayload> {
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object") return parsed as ClientErrorPayload;
  } catch {
    return {};
  }
  return {};
}

export default function NewClientModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    vatNumber: "",
  });

  function setField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Naam is verplicht");
    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const payload = await readErrorPayload(res);
        console.error("Klant aanmaken mislukt", {
          status: res.status,
          error: payload.error,
          message: payload.message,
        });
        throw new Error(getClientCreateError(res.status, payload));
      }

      toast.success("Klant aangemaakt");
      setOpen(false);
      setForm({ name: "", email: "", phone: "", address: "", vatNumber: "" });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Klant aanmaken mislukt. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={16} /> Klant toevoegen
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Klant toevoegen</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Naam *</label>
                <input className="input" placeholder="Jan de Vries Schilderwerk" value={form.name} onChange={(e) => setField("name", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">E-mail</label>
                  <input className="input" type="email" placeholder="jan@..." value={form.email} onChange={(e) => setField("email", e.target.value)} />
                </div>
                <div>
                  <label className="label">Telefoon</label>
                  <input className="input" placeholder="+31 6..." value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Adres</label>
                <textarea className="input h-16 resize-none" placeholder="Straat 1&#10;1234 AB Stad" value={form.address} onChange={(e) => setField("address", e.target.value)} />
              </div>
              <div>
                <label className="label">BTW-nummer</label>
                <input className="input font-mono" placeholder="NL123456789B01" value={form.vatNumber} onChange={(e) => setField("vatNumber", e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setOpen(false)}>Annuleren</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? "Opslaan..." : "Aanmaken"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
