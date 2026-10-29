"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hourlyRate, type ShiftType } from "@/lib/shift-rates";
import { Plus, Save } from "lucide-react";
import toast from "react-hot-toast";
import InvoiceItemRow, { type DraftItem } from "./InvoiceItemRow";
import { calcInvoiceTotals, defaultUnit } from "@/lib/calculations";
import type { Client, ItemType } from "@/types/invoice";

interface Props {
  clients: Client[];
  initialClientId?: string;
}

type ApiErrorResponse = {
  error?: unknown;
  message?: string;
};

type CreatedInvoiceResponse = {
  id: string;
};

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

function emptyItem(rates?: unknown, ortEnabled = false): DraftItem {
  return {
    id: Math.random().toString(36).slice(2),
    type: "HOURS",
    description: "",
    quantity: 1,
    unitPrice: hourlyRate(rates, "DAY", ortEnabled) ?? 0,
    unit: "uur",
    serviceType: "DAY",
    rateMissing: hourlyRate(rates, "DAY", ortEnabled) === null,
    ortPerc: 0,
  };
}

function isCreatedInvoiceResponse(value: unknown): value is CreatedInvoiceResponse {
  if (typeof value !== "object" || value === null) return false;
  const invoice = value as Partial<Record<"id", unknown>>;
  return typeof invoice.id === "string" && invoice.id.length > 0;
}

async function readApiError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as ApiErrorResponse | null;

  if (body?.message) return body.message;
  if (typeof body?.error === "string") return body.error;
  return fallback;
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
  const selectedClient = clients.find(client => client.id === clientId);
  const [ortEnabled, setOrtEnabled] = useState(false);
  const [items, setItems] = useState<DraftItem[]>(() => [emptyItem((clients.find(client => client.id === (initialClientId ?? clients[0]?.id)))?.shiftRates)]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems(prev => [...prev, emptyItem(selectedClient?.shiftRates, ortEnabled)]);
  function changeClient(id: string) {
    const client = clients.find(client => client.id === id);
    setClientId(id); setOrtEnabled(false);
    setItems(prev => prev.map(item => item.type === "HOURS" ? { ...item, unitPrice: hourlyRate(client?.shiftRates, item.serviceType) ?? 0, rateMissing: hourlyRate(client?.shiftRates, item.serviceType) === null, ortPerc: 0 } : item));
  }
  function changeOrt(enabled: boolean) {
    setOrtEnabled(enabled);
    setItems(prev => prev.map(item => item.type === "HOURS" ? { ...item, unitPrice: hourlyRate(selectedClient?.shiftRates, item.serviceType, enabled) ?? 0, rateMissing: hourlyRate(selectedClient?.shiftRates, item.serviceType, enabled) === null, ortPerc: 0 } : item));
  }

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
          updated.ortPerc = 0;
          if (value === "HOURS") {
            updated.serviceType = "DAY";
            updated.unitPrice = hourlyRate(selectedClient?.shiftRates, "DAY", ortEnabled) ?? 0;
            updated.rateMissing = hourlyRate(selectedClient?.shiftRates, "DAY", ortEnabled) === null;
          }
        }
        if (field === "serviceType") {
          updated.unitPrice = hourlyRate(selectedClient?.shiftRates, value as ShiftType, ortEnabled) ?? 0;
          updated.rateMissing = hourlyRate(selectedClient?.shiftRates, value as ShiftType, ortEnabled) === null;
        }
        if (field === "unitPrice") { updated.unitPrice = Number(value); updated.rateMissing = value === ""; }
        return updated;
      })
    );
  }, [selectedClient, ortEnabled]);

  const totals = calcInvoiceTotals(
    items.map((i) => ({ type: i.type, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, unit: i.unit, ortPerc: ortEnabled ? i.ortPerc : 0 })),
    vatRate
  );

  async function submit() {
    if (!clientId) return toast.error("Selecteer een klant");
    if (items.some(item => item.type === "HOURS" && item.rateMissing)) return toast.error("Stel voor elke urenregel een uurtarief in. Vul expliciet 0 in voor gratis werk.");
    if (items.some((i) => !i.description)) return toast.error("Vul alle omschrijvingen in");

    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          ortAgreed: ortEnabled,
          dueDate,
          vatRate,
          notes: notes || undefined,
          items: items.map((item, idx) => ({
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unit: item.unit,
            serviceType: item.type === "HOURS" ? item.serviceType : null,
            ortPerc: ortEnabled && item.type === "HOURS" ? item.ortPerc : 0,
            sortOrder: idx,
          })),
        }),
      });

      if (res.status === 402) {
        router.push("/billing");
        return;
      }
      if (!res.ok) {
        throw new Error(await readApiError(res, "Opslaan mislukt"));
      }

      const createdInvoice = await res.json() as unknown;
      if (!isCreatedInvoiceResponse(createdInvoice)) {
        throw new Error("Factuur is opgeslagen, maar het factuur-id ontbreekt.");
      }

      toast.success("Factuur aangemaakt als concept");
      router.push(`/invoices/${createdInvoice.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Er ging iets mis. Probeer opnieuw.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Klant *</label>
          <select className="input" value={clientId} onChange={(e) => changeClient(e.target.value)}>
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

      <div className="card p-4 space-y-3 text-sm">
        <p className="font-semibold">Vaste uurtarieven per dienst</p>
        <p>De tarieven van de gekozen klant worden overgenomen. Een aangepaste prijs geldt alleen voor deze factuur.</p>
        {selectedClient && <Link href={`/clients/${selectedClient.id}/edit`} className="text-[#543749] underline">Tarieven en ORT-afspraak voor deze klant instellen</Link>}
        <label className="flex items-start gap-2"><input type="checkbox" checked={ortEnabled} disabled={!selectedClient?.ortAgreed} onChange={e => changeOrt(e.target.checked)} className="mt-1" />
          <span>ORT gebruiken voor deze factuur — alleen zoals afgesproken met deze klant.</span>
        </label>
        <p className="text-xs text-[#726671]">{ortEnabled ? "ORT wordt berekend op het dagdiensttarief als basisuurtarief. Kies per urenregel 25%, 50% of 100%; geen automatische combinatie met hogere diensttarieven." : "ORT staat uit. Leg een ORT-afspraak vast bij de klant om deze optie beschikbaar te maken."}</p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-[#eee5e1] px-4 py-3 text-sm font-semibold text-[#574c57]">
          Regelposten
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[890px] text-sm">
            <thead>
              <tr className="border-b border-[#eee5e1] text-xs text-[#726671]">
                <th className="px-3 py-2 text-left w-8">#</th>
                <th className="px-2 py-2 text-left w-32">Type</th>
                <th className="px-2 py-2 text-left w-36">Dienst</th>
                <th className="px-2 py-2 text-left">Omschrijving</th>
                <th className="px-2 py-2 text-right w-24">Aantal</th>
                <th className="px-2 py-2 text-center w-20">Eenheid</th>
                <th className="px-2 py-2 text-right w-28">Prijs</th>
                {ortEnabled && <th className="px-2 py-2 text-left w-24">ORT</th>}
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
                  ortEnabled={ortEnabled}
                  onChange={changeItem}
                  onRemove={removeItem}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-[#eee5e1]">
          <button type="button" onClick={addItem} className="btn-secondary text-xs">
            <Plus size={14} /> Regel toevoegen
          </button>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="w-full max-w-[300px] space-y-2 text-sm">
          {totals.ortAmount > 0 && (
            <>
              <div className="flex justify-between text-[#675b66]">
                <span>Basisbedrag</span>
                <span>{formatEuro(totals.subtotal - totals.ortAmount)}</span>
              </div>
              <div className="flex justify-between text-[#9a624d]">
                <span>ORT</span>
                <span>{formatEuro(totals.ortAmount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-[#675b66]">
            <span>Subtotaal</span>
            <span>{formatEuro(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-[#675b66]">
            <span>BTW ({vatRate}%)</span>
            <span>{formatEuro(totals.vatAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-[#e4d9d5] pt-2 font-bold text-[#33243b]">
            <span>Totaal</span>
            <span className="text-lg">{formatEuro(totals.total)}</span>
          </div>
        </div>
      </div>

      <div>
        <label className="label">Notities</label>
        <textarea
          className="input h-20 resize-none"
          placeholder="Aanvullende tekst voor deze factuur..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-[#e4d9d5] pt-4">
        <button
          type="button"
          className="btn-primary"
          disabled={saving}
          onClick={() => submit()}
        >
          <Save size={15} /> {saving ? "Aanmaken..." : "Factuur aanmaken"}
        </button>
      </div>
    </div>
  );
}
