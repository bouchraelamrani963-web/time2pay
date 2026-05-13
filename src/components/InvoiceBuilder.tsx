"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Send } from "lucide-react";
import toast from "react-hot-toast";
import InvoiceItemRow, { type DraftItem } from "./InvoiceItemRow";
import { calcInvoiceTotals, defaultUnit } from "@/lib/calculations";
import type { Client, ItemType } from "@/types/invoice";

interface Props {
  clients: Client[];
  initialClientId?: string;
}

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

function emptyItem(): DraftItem {
  return {
    id: Math.random().toString(36).slice(2),
    type: "HOURS",
    description: "",
    quantity: 1,
    unitPrice: 0,
    unit: "uur",
  };
}

export default function InvoiceBuilder({ clients, initialClientId }: Props) {
  const router = useRouter();
  const [clientId, setClientId] = useState(initialClientId ?? clients[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [vatRate, setVatRate] = useState(21);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const changeItem = useCallback((id: string, field: keyof DraftItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "type") {
          updated.unit = defaultUnit(value as ItemType);
        }
        return updated;
      })
    );
  }, []);

  const totals = calcInvoiceTotals(
    items.map((i) => ({ type: i.type, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, unit: i.unit })),
    vatRate
  );

  async function submit(status: "DRAFT" | "SENT") {
    if (!clientId) return toast.error("Selecteer een klant");
    if (items.some((i) => !i.description)) return toast.error("Vul alle omschrijvingen in");

    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          dueDate,
          vatRate,
          notes: notes || undefined,
          items: items.map((item, idx) => ({
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unit: item.unit,
            sortOrder: idx,
          })),
        }),
      });

      if (!res.ok) throw new Error("Opslaan mislukt");
      const invoice = await res.json();

      if (status === "SENT") {
        await fetch(`/api/invoices/${invoice.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SENT" }),
        });
      }

      toast.success(status === "SENT" ? "Factuur aangemaakt en verzonden!" : "Concept opgeslagen");
      router.push(`/invoices/${invoice.id}`);
      router.refresh();
    } catch {
      toast.error("Er ging iets mis. Probeer opnieuw.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Klant *</label>
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.length === 0 && <option value="">— geen klanten —</option>}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Vervaldatum *</label>
          <input
            className="input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">BTW %</label>
          <select className="input" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))}>
            <option value={0}>0% (vrijgesteld)</option>
            <option value={9}>9% (laag tarief)</option>
            <option value={21}>21% (standaard)</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
          Regelposten
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="px-3 py-2 text-left w-8">#</th>
                <th className="px-2 py-2 text-left w-32">Type</th>
                <th className="px-2 py-2 text-left">Omschrijving</th>
                <th className="px-2 py-2 text-right w-24">Aantal</th>
                <th className="px-2 py-2 text-center w-20">Eenheid</th>
                <th className="px-2 py-2 text-right w-28">Prijs</th>
                <th className="px-3 py-2 text-right w-28">Totaal</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <InvoiceItemRow
                  key={item.id}
                  item={item}
                  index={idx}
                  onChange={changeItem}
                  onRemove={removeItem}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100">
          <button type="button" onClick={addItem} className="btn-secondary text-xs">
            <Plus size={14} /> Regel toevoegen
          </button>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="w-72 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotaal</span>
            <span>{formatEuro(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>BTW ({vatRate}%)</span>
            <span>{formatEuro(totals.vatAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
            <span>Totaal</span>
            <span className="text-lg">{formatEuro(totals.total)}</span>
          </div>
        </div>
      </div>

      <div>
        <label className="label">Notities / betalingsinstructies</label>
        <textarea
          className="input h-20 resize-none"
          placeholder="Bijv. IBAN, betalingstermijn, dank voor uw opdracht..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
        <button
          type="button"
          className="btn-secondary"
          disabled={saving}
          onClick={() => submit("DRAFT")}
        >
          <Save size={15} /> Opslaan als concept
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={saving}
          onClick={() => submit("SENT")}
        >
          <Send size={15} /> Aanmaken &amp; verzenden
        </button>
      </div>
    </div>
  );
}
