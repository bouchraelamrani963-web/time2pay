import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { FileText, Users, TrendingUp, Clock } from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS } from "@/types/invoice";
import type { InvoiceStatus } from "@/types/invoice";

function formatEuro(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

export default async function DashboardPage() {
  const [invoices, clients] = await Promise.all([
    prisma.invoice.findMany({
      include: { client: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.client.count(),
  ]);

  const allInvoices = await prisma.invoice.findMany();
  const totalRevenue = allInvoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0);
  const outstanding = allInvoices.filter((i) => ["SENT", "OVERDUE"].includes(i.status)).reduce((s, i) => s + i.total, 0);
  const draftCount = allInvoices.filter((i) => i.status === "DRAFT").length;

  const stats = [
    { label: "Totale omzet", value: formatEuro(totalRevenue), icon: TrendingUp, color: "text-green-600" },
    { label: "Openstaand", value: formatEuro(outstanding), icon: Clock, color: "text-orange-500" },
    { label: "Facturen", value: allInvoices.length, icon: FileText, color: "text-blue-600" },
    { label: "Klanten", value: clients, icon: Users, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Overzicht van je facturatie</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className={`mb-2 ${color}`}>
              <Icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {draftCount > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          Je hebt <strong>{draftCount} concept-factuur{draftCount > 1 ? "en" : ""}</strong> die nog niet verzonden zijn.{" "}
          <Link href="/invoices?status=DRAFT" className="underline font-semibold">Bekijken</Link>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Recente facturen</h2>
          <Link href="/invoices" className="text-sm text-blue-600 hover:underline">Alle facturen</Link>
        </div>
        {invoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            Nog geen facturen.{" "}
            <Link href="/invoices/new" className="text-blue-600 underline">Maak je eerste factuur</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="px-6 py-3 text-left font-medium">Nummer</th>
                <th className="px-6 py-3 text-left font-medium">Klant</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <Link href={`/invoices/${inv.id}`} className="font-mono font-semibold text-blue-600 hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-gray-700">{inv.client.name}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[inv.status as InvoiceStatus]}`}>
                      {STATUS_LABELS[inv.status as InvoiceStatus]}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right font-semibold">{formatEuro(inv.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
