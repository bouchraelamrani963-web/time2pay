"use client";

import { shiftLabel } from "@/lib/shift-rates";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Printer,
  Download,
  Trash2,
  CheckCircle,
  Send,
  RotateCcw,
  BellRing,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import toast from "react-hot-toast";
import { STATUS_LABELS, STATUS_COLORS, ITEM_TYPE_LABELS } from "@/types/invoice";
import type { Invoice, InvoiceStatus } from "@/types/invoice";
import { effectiveStatus, daysOverdue, paymentDays } from "@/lib/invoice-status";

interface Props {
  invoice: Invoice;
  canExport: boolean;
}

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam", day: "2-digit", month: "long", year: "numeric" });
}

function formatReminderCount(count: number) {
  return `${count}e herinnering verstuurd`;
}

type ApiResponse = {
  error?: unknown;
  message?: string;
  sentTo?: string;
};

async function readApiResponse(response: Response) {
  return await response.json().catch(() => null) as ApiResponse | null;
}

function getApiErrorMessage(body: ApiResponse | null, fallback: string) {
  if (body?.message) return body.message;
  if (typeof body?.error === "string") return body.error;
  return fallback;
}

const STATUS_TRANSITIONS: Partial<Record<InvoiceStatus, { label: string; next: InvoiceStatus; icon: React.ReactNode }>> = {
  DRAFT: { label: "Markeer als verzonden", next: "SENT", icon: <Send size={15} /> },
  SENT: { label: "Markeer als betaald", next: "PAID", icon: <CheckCircle size={15} /> },
  OVERDUE: { label: "Markeer als betaald", next: "PAID", icon: <CheckCircle size={15} /> },
  PAID: { label: "Terugzetten naar concept", next: "DRAFT", icon: <RotateCcw size={15} /> },
};

export default function InvoiceView({ invoice, canExport }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const effStatus = effectiveStatus(invoice);
  const overdueDays = daysOverdue(invoice);
  const payDays = paymentDays(invoice);
  const isOverdue = effStatus === "OVERDUE";
  const canRemind = (effStatus === "SENT" || effStatus === "OVERDUE");
  const ortAmount = invoice.items.reduce((sum, item) => sum + (item.ortBedrag ?? 0), 0);
  const reminderCount = Math.max(0, invoice.reminderCount ?? 0);

  async function exportInvoice(print: boolean) {
    if (!canExport) return router.push("/billing");
    setBusy(true);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, { cache: "no-store" });
      if (response.status === 402) return router.push("/billing");
      if (!response.ok) throw new Error("PDF openen mislukt");
      const blob = await response.blob();
      if (print) { window.print(); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `factuur-${invoice.number.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF openen mislukt");
    } finally { setBusy(false); }
  }

  async function updateStatus(status: InvoiceStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.status === 402) return router.push("/billing");
      if (!res.ok) throw new Error();
      toast.success("Status bijgewerkt");
      router.refresh();
    } catch {
      toast.error("Bijwerken mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function sendReminder() {
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/remind`, { method: "POST" });
      const body = await readApiResponse(res);
      if (res.status === 402) return router.push("/billing");
      if (!res.ok) {
        throw new Error(getApiErrorMessage(body, "Herinnering versturen mislukt"));
      }
      toast.success(`Betalingsherinnering verstuurd${body?.sentTo ? ` naar ${body.sentTo}` : ""}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Herinnering versturen mislukt");
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

  const transition = STATUS_TRANSITIONS[effStatus];

  return (
    <div className={`space-y-6 ${!canExport ? "invoice-preview-locked" : ""}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold font-mono text-[#33243b]">{invoice.number}</h1>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[effStatus]}`}>
            {STATUS_LABELS[effStatus]}
          </span>
          {isOverdue && overdueDays > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2.5 py-1 text-xs font-semibold">
              <AlertTriangle size={12} /> {overdueDays} dag{overdueDays !== 1 ? "en" : ""} te laat
            </span>
          )}
          {reminderCount > 0 && effStatus !== "PAID" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-xs font-semibold">
              <BellRing size={12} /> {formatReminderCount(reminderCount)}
            </span>
          )}
          {invoice.status === "PAID" && payDays !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 px-2.5 py-1 text-xs font-semibold">
              <CheckCircle size={12} /> Betaald in {payDays} dag{payDays !== 1 ? "en" : ""}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap no-print">
          {canRemind && (
            <button className="btn-secondary" disabled={busy} onClick={sendReminder}>
              <BellRing size={15} /> {invoice.reminderSentAt ? "Opnieuw versturen" : "Stuur herinnering"}
            </button>
          )}
          {transition && (
            <button className="btn-secondary" disabled={busy} onClick={() => updateStatus(transition.next)}>
              {transition.icon} {transition.label}
            </button>
          )}
          <button className="btn-secondary" disabled={busy} onClick={() => exportInvoice(false)}>
            <Download size={15} /> PDF downloaden
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => exportInvoice(true)}>
            <Printer size={15} /> Afdrukken
          </button>
          <button className="btn-danger" disabled={busy} onClick={deleteInvoice}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {!canExport && <div className="card p-4 text-sm no-print">
        <strong>Gratis conceptfactuur</strong>
        <p>Je kunt één factuur opstellen. Voor verzenden, PDF downloaden of afdrukken is een betaald abonnement nodig.</p>
        <button className="btn-primary mt-3" onClick={() => router.push("/billing")}>Bekijk abonnementen</button>
      </div>}
      {!canExport && <p className="locked-print-message hidden">Concept — een betaald Time2Pay-abonnement is vereist om deze factuur af te drukken.</p>}
      {isOverdue && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 no-print">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Deze factuur is {overdueDays} dag{overdueDays !== 1 ? "en" : ""} te laat.</p>
            {invoice.reminderSentAt ? (
              <p className="text-xs mt-0.5">
                Laatste herinnering: {formatDate(invoice.reminderSentAt)}. Overweeg telefonisch contact op te nemen.
              </p>
            ) : (
              <p className="text-xs mt-0.5">Stuur een vriendelijke herinnering om de betaling te versnellen.</p>
            )}
          </div>
        </div>
      )}

      <div className={`card p-6 space-y-6 print:shadow-none print:border-none ${isOverdue ? "ring-1 ring-red-200" : ""}`} id="invoice-print">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-2xl font-semibold tracking-tight text-[#543749]">Time<span className="text-[#33243b]">2Pay</span></p>
          </div>
          <div className="text-right text-sm text-[#675b66] space-y-0.5">
            <p className="text-lg font-bold font-mono text-[#33243b]">{invoice.number}</p>
            <p>Factuurdatum: {formatDate(invoice.issueDate)}</p>
            <p>
              Vervaldatum:{" "}
              <span className={isOverdue ? "text-red-600 font-semibold" : ""}>{formatDate(invoice.dueDate)}</span>
            </p>
            {invoice.paidAt && (
              <p className="text-green-700 font-semibold flex items-center justify-end gap-1">
                <Calendar size={12} /> Betaald op {formatDate(invoice.paidAt)}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-[#eee5e1] pt-4">
          <p className="text-xs text-[#92858d] uppercase font-semibold mb-1">Klant</p>
          <p className="font-bold text-[#33243b]">{invoice.client.name}</p>
          {invoice.client.address && <p className="text-sm text-[#675b66] whitespace-pre-line">{invoice.client.address}</p>}
          {invoice.client.email && <p className="text-sm text-[#675b66]">{invoice.client.email}</p>}
          {invoice.client.vatNumber && <p className="text-sm text-[#726671]">BTW: {invoice.client.vatNumber}</p>}
        </div>

        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm border-t border-[#eee5e1] pt-4">
          <thead>
            <tr className="border-b-2 border-[#e4d9d5] text-xs text-[#726671]">
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
                <td className="py-2 pr-4 text-[#726671] text-xs">{shiftLabel(item.serviceType) || ITEM_TYPE_LABELS[item.type]}</td>
                <td className="py-2 pr-4">{item.description}</td>
                <td className="py-2 text-right text-[#675b66]">
                  {item.type === "FIXED" ? "—" : `${item.quantity} ${item.unit ?? ""}`}
                </td>
                <td className="py-2 text-right text-[#675b66]">{formatEuro(item.unitPrice)}</td>
                <td className="py-2 text-right font-semibold">{formatEuro(item.lineTotal + (item.ortBedrag ?? 0))}{(item.ortBedrag ?? 0) > 0 && <span className="block text-xs font-normal text-[#9a624d]">Basis {formatEuro(item.lineTotal)} + ORT {item.ortPerc}%: +{formatEuro(item.ortBedrag ?? 0)}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>

        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            {ortAmount > 0 && <><div className="flex justify-between"><span>Basisbedrag</span><span>{formatEuro(invoice.subtotal - ortAmount)}</span></div><div className="flex justify-between"><span>ORT</span><span>{formatEuro(ortAmount)}</span></div></>}
            <div className="flex justify-between text-[#675b66]">
              <span>Subtotaal</span>
              <span>{formatEuro(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#675b66]">
              <span>BTW ({invoice.vatRate}%)</span>
              <span>{formatEuro(invoice.vatAmount)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-gray-900 pt-2 font-bold text-[#33243b]">
              <span>Totaal te betalen</span>
              <span className="text-lg">{formatEuro(invoice.total)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="border-t border-[#eee5e1] pt-4 text-sm text-[#675b66]">
            <p className="text-xs text-[#92858d] uppercase font-semibold mb-1">Notities</p>
            <p className="whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
