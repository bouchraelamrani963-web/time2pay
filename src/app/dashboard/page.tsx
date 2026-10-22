import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { Clock, FileText, ReceiptText, TrendingUp, Users } from "lucide-react";
import { STATUS_COLORS, STATUS_LABELS } from "@/types/invoice";
import type { InvoiceStatus } from "@/types/invoice";
import { effectiveStatus } from "@/lib/invoice-status";

function formatEuro(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

export default async function DashboardPage() {
  const user = await requireUser();

  const [invoices, clients, allInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId: user.uid },
      include: { client: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.client.count({ where: { userId: user.uid } }),
    prisma.invoice.findMany({ where: { userId: user.uid } }),
  ]);

  const paidInvoices = allInvoices.filter((i) => i.status === "PAID");
  const totalRevenue = paidInvoices.reduce((s, i) => s + i.subtotal, 0);
  const vatReceived = paidInvoices.reduce((s, i) => s + i.vatAmount, 0);
  const outstanding = allInvoices
    .filter((i) => {
      const status = effectiveStatus({
        status: i.status as InvoiceStatus,
        dueDate: i.dueDate,
        issueDate: i.issueDate,
      });
      return status === "SENT" || status === "OVERDUE";
    })
    .reduce((s, i) => s + i.total, 0);
  const draftCount = allInvoices.filter((i) => i.status === "DRAFT").length;

  const stats = [
    { label: "Omzet exclusief btw", value: formatEuro(totalRevenue), icon: TrendingUp, color: "text-[#9a624d]" },
    { label: "BTW ontvangen", value: formatEuro(vatReceived), icon: ReceiptText, color: "text-[#9a624d]" },
    { label: "Openstaand", value: formatEuro(outstanding), icon: Clock, color: "text-[#9a624d]" },
    { label: "Facturen", value: allInvoices.length, icon: FileText, color: "text-[#9a624d]" },
    { label: "Klanten", value: clients, icon: Users, color: "text-[#9a624d]" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[#33243b]">Dashboard</h1>
        <p className="text-sm text-[#726671]">Overzicht van je facturatie</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card flex min-h-[142px] flex-col justify-between p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-[#726671]">{label}</p>
              <Icon size={18} className={color} aria-hidden />
            </div>
            <p className="mt-6 text-[clamp(1.25rem,1.7vw,1.7rem)] font-semibold tracking-[-0.035em] tabular-nums text-[#33243b]">{value}</p>
          </div>
        ))}
      </div>

      {draftCount > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          Je hebt <strong>{draftCount} concept-factuur{draftCount > 1 ? "en" : ""}</strong> die nog niet verzonden zijn.{" "}
          <Link href="/invoices?status=DRAFT" className="underline font-semibold">Bekijken</Link>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between border-b border-[#eee5e1] px-6 py-4">
          <h2 className="font-semibold text-[#33243b]">Recente facturen</h2>
          <Link href="/invoices" className="text-sm text-[#543749] hover:underline">Alle facturen</Link>
        </div>
        {invoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[#726671]">
            Nog geen facturen.{" "}
            <Link href="/invoices/new" className="text-[#543749] underline">Maak je eerste factuur</Link>
          </div>
        ) : (
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-[#eee5e1] text-xs text-[#726671]">
                <th className="px-6 py-3 text-left font-medium">Nummer</th>
                <th className="px-6 py-3 text-left font-medium">Klant</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const displayStatus = effectiveStatus({
                  status: inv.status as InvoiceStatus,
                  dueDate: inv.dueDate,
                  issueDate: inv.issueDate,
                });

                return (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-[#fbf8f5]">
                    <td className="px-6 py-3">
                      <Link href={`/invoices/${inv.id}`} className="font-mono font-semibold text-[#543749] hover:underline">
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-gray-700">{inv.client.name}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[displayStatus]}`}>
                        {STATUS_LABELS[displayStatus]}
                      </span>
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
