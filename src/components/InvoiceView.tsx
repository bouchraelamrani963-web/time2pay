"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Trash2, CheckCircle, Send, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { STATUS_LABELS, STATUS_COLORS, ITEM_TYPE_LABELS } from "@/types/invoice";
import type { Invoice, InvoiceStatus } from "@/types/invoice";

interface Props {
  invoice: Invoice;
}

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("nl-NL", { day: "2-digit", month: "long", year: "numeric" });
}

const STATUS_TRANSITIONS: Partial<Record<InvoiceStatus, { label: string; next: InvoiceStatus; icon: React.ReactNode }>> = {
  DRAFT: { label: "Markeer als verzonden", next: "SENT", icon: <Send size={15} /> },
  SENT: { label: "Markeer als betaald", next: "PAID", icon: <CheckCircle size={15} /> },
  OVERDUE: { label: "Markeer als betaald", next: "PAID", icon: <CheckCircle size={15} /> },
  PAID: { label: "Terugzetten naar concept", next: "DRAFT", icon: <RotateCcw size={15} /> },
};

export default function InvoiceView({ invoice }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function updateStatus(status: InvoiceStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success("Status bijgewerkt");
      router.refresh();
    } catch {
      toast.error("Bijwerken mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function deleteInvoice() {
    if (!confirm(`Factuur ${invoice.number} verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
      toast.success("Factuur verwijderd");
      router.push("/invoices");
      router.refresh();
    } catch {
      toast.error("Verwijderen mislukt");
    } finally {
      setBusy(false);
    }
  }

  const transition = STATUS_TRANSITIONS[invoice.status];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-mono text-gray-900">{invoice.number}</h1>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[invoice.status]}`}>
            {STATUS_LABELS[invoice.status]}
          </span>
        </div>
        <div className="flex gap-2">
          {transition && (
            <button className="btn-secondary" disabled={busy} onClick={() => updateStatus(transition.next)}>
              {transition.icon} {transition.label}
            </button>
          )}
          <button className="btn-secondary" onClick={() => window.print()}>
            <Printer size={15} /> Afdrukken
          </button>
          <button className="btn-danger" disabled={busy} onClick={deleteInvoice}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-6 print:shadow-none print:border-none" id="invoice-print">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-2xl font-black text-blue-600">Time<span className="text-gray-900">2Pay</span></p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p className="text-lg font-bold font-mono text-gray-900">{invoice.number}</p>
            <p>Factuurdatum: {formatDate(invoice.issueDate)}</p>
            <p>Vervaldatum: <span className={invoice.status === "OVERDUE" ? "text-red-600 font-semibold" : ""}>{formatDate(invoice.dueDate)}</span></p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Klant</p>
          <p className="font-bold text-gray-900">{invoice.client.name}</p>
          {invoice.client.address && <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.client.address}</p>}
          {invoice.client.email && <p className="text-sm text-gray-600">{invoice.client.email}</p>}
          {invoice.client.vatNumber && <p className="text-sm text-gray-500">BTW: {invoice.client.vatNumber}</p>}
        </div>

        <table className="w-full text-sm border-t border-gray-100 pt-4">
          <thead>
            <tr className="border-b-2 border-gray-200 text-xs text-gray-500">
              <th className="py-2 text-left font-semibold">Type</th>
              <th className="py-2 text-left font-semibold">Omschrijving</th>
              <th className="py-2 text-right font-semibold">Aantal</th>
              <th className="py-2 text-right font-semibold">Prijs</th>
              <th className="py-2 text-right font-semibold">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-50">
                <td className="py-2 pr-4 text-gray-500 text-xs">{ITEM_TYPE_LABELS[item.type]}</td>
                <td className="py-2 pr-4">{item.description}</td>
                <td className="py-2 text-right text-gray-600">
                  {item.type === "FIXED" ? "—" : `${item.quantity} ${item.unit ?? ""}`}
                </td>
                <td className="py-2 text-right text-gray-600">{formatEuro(item.unitPrice)}</td>
                <td className="py-2 text-right font-semibold">{formatEuro(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotaal</span>
              <span>{formatEuro(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>BTW ({invoice.vatRate}%)</span>
              <span>{formatEuro(invoice.vatAmount)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-gray-900 pt-2 font-bold text-gray-900">
              <span>Totaal te betalen</span>
              <span className="text-lg">{formatEuro(invoice.total)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="border-t border-gray-100 pt-4 text-sm text-gray-600">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Notities</p>
            <p className="whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
