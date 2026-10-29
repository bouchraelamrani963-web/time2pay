import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { BellRing, Plus } from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS } from "@/types/invoice";
import type { InvoiceStatus } from "@/types/invoice";
import { effectiveStatus } from "@/lib/invoice-status";

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" });
}

function formatReminderCount(count: number) {
  return `${count} herinnering${count === 1 ? "" : "en"}`;
}

export default async function InvoicesPage(
  props: {
    searchParams: Promise<{ status?: string; clientId?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const statuses: (InvoiceStatus | "all")[] = ["all", "DRAFT", "SENT", "PAID", "OVERDUE"];
  const requestedStatus = searchParams.status as InvoiceStatus | undefined;
  const status = requestedStatus && statuses.includes(requestedStatus) ? requestedStatus : undefined;
  const clientId = searchParams.clientId;

  const invoices = await prisma.invoice.findMany({
    where: {
      userId: user.uid,
      ...(clientId ? { clientId } : {}),
    },
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });

  const filteredInvoices = status
    ? invoices.filter((invoice) => effectiveStatus({
        status: invoice.status as InvoiceStatus,
        dueDate: invoice.dueDate,
        issueDate: invoice.issueDate,
      }) === status)
    : invoices;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[#33243b]">Facturen</h1>
          <p className="text-sm text-[#726671]">{filteredInvoices.length} factuur{filteredInvoices.length !== 1 ? "en" : ""}</p>
        </div>
        <Link href="/invoices/new" className="btn-primary">
          <Plus size={16} /> Nieuwe factuur
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/invoices" : `/invoices?status=${s}`}
            className={`rounded-md border border-[#e6dcd8] px-3 py-2 text-xs font-semibold transition-colors ${
              (s === "all" && !status) || s === status
                ? "bg-[#543749] text-white"
                : "bg-white text-[#675b66] hover:bg-[#fbf8f5]"
            }`}
          >
            {s === "all" ? "Alle" : STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {filteredInvoices.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#726671]">
            Nog geen facturen in dit overzicht.{" "}
            <Link href="/invoices/new" className="text-[#543749] underline">Maak er een aan</Link>
          </div>
        ) : (
          <table className="w-full min-w-[790px] text-sm">
            <thead>
              <tr className="border-b border-[#eee5e1] text-xs text-[#726671]">
                <th className="px-6 py-3 text-left font-medium">Nummer</th>
                <th className="px-6 py-3 text-left font-medium">Klant</th>
                <th className="px-6 py-3 text-left font-medium">Datum</th>
                <th className="px-6 py-3 text-left font-medium">Vervalt</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => {
                const displayStatus = effectiveStatus({
                  status: inv.status as InvoiceStatus,
                  dueDate: inv.dueDate,
                  issueDate: inv.issueDate,
                });
                const reminderCount = Math.max(0, inv.reminderCount ?? 0);

                return (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-[#fbf8f5]">
                    <td className="px-6 py-3">
                      <Link href={`/invoices/${inv.id}`} className="font-mono font-semibold text-[#543749] hover:underline">
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-[#574c57]">{inv.client.name}</td>
                    <td className="px-6 py-3 text-[#726671]">{formatDate(inv.issueDate)}</td>
                    <td className="px-6 py-3 text-[#726671]">{formatDate(inv.dueDate)}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[displayStatus]}`}>
                          {STATUS_LABELS[displayStatus]}
                        </span>
                        {reminderCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                            <BellRing size={12} /> {formatReminderCount(reminderCount)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right font-semibold">{formatEuro(inv.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
