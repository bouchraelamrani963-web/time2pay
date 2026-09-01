import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import Link from "next/link";
import {
  FileText,
  Users,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Plus,
  Sparkles,
  AlertTriangle,
  Timer,
  BellRing,
} from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS } from "@/types/invoice";
import type { InvoiceStatus } from "@/types/invoice";
import { effectiveStatus, avgPaymentDays, wasPaidLate, daysOverdue } from "@/lib/invoice-status";

function formatEuro(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("nl-NL", { day: "2-digit", month: "short" });
}

export default async function Dashboard({ user }: { user: SessionUser }) {
  const [recent, clientsCount, allRaw] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId: user.uid },
      include: { client: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.client.count({ where: { userId: user.uid } }),
    prisma.invoice.findMany({ where: { userId: user.uid } }),
  ]);

  // Normalize for status helpers (Date → ISO)
  const allInvoices = allRaw.map((i) => ({
    status: i.status as InvoiceStatus,
    dueDate: i.dueDate.toISOString(),
    issueDate: i.issueDate.toISOString(),
    total: i.total,
  }));

  const totalRevenue = allInvoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0);
  const outstanding = allInvoices
    .filter((i) => effectiveStatus(i) === "SENT" || effectiveStatus(i) === "OVERDUE")
    .reduce((s, i) => s + i.total, 0);

  const overdueInvoices = allInvoices.filter((i) => effectiveStatus(i) === "OVERDUE");
  const overdueCount = overdueInvoices.length;
  const overdueAmount = overdueInvoices.reduce((s, i) => s + i.total, 0);
  const draftCount = allInvoices.filter((i) => i.status === "DRAFT").length;
  const paidLateCount = allInvoices.filter(wasPaidLate).length;
  const avgPay = avgPaymentDays(allInvoices);

  const stats = [
    {
      label: "Totale omzet",
      value: formatEuro(totalRevenue),
      icon: TrendingUp,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
      hint: "Alle betaalde facturen",
    },
    {
      label: "Openstaand bedrag",
      value: formatEuro(outstanding),
      icon: Clock,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
      hint: overdueCount > 0
        ? `Waarvan ${formatEuro(overdueAmount)} te laat`
        : "Geen achterstand",
    },
    {
      label: "Gem. betalingstijd",
      value: avgPay !== null ? `${avgPay} dgn` : "—",
      icon: Timer,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      hint: avgPay !== null ? "Dagen tussen versturen & betaling" : "Nog geen betaalde facturen",
    },
    {
      label: "Te laat betaald",
      value: paidLateCount.toString(),
      icon: AlertTriangle,
      iconBg: paidLateCount > 0 ? "bg-red-50" : "bg-gray-50",
      iconColor: paidLateCount > 0 ? "text-red-600" : "text-gray-400",
      hint: paidLateCount > 0 ? "Historisch te laat" : "Klanten betalen op tijd",
    },
  ];

  const meta = [
    { label: "Facturen totaal", value: allInvoices.length, icon: FileText },
    { label: "Concept", value: draftCount, icon: FileText },
    { label: "Klanten", value: clientsCount, icon: Users },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-blue-600 flex items-center gap-1.5">
            <Sparkles size={14} /> Dashboard
          </p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-tight text-gray-900">
            Welkom terug
          </h1>
          <p className="mt-3 text-base text-gray-500 max-w-xl">
            Inzicht in je omzet, openstaande facturen en betaalgedrag.
          </p>
        </div>
        <Link href="/invoices/new" className="btn-primary">
          <Plus size={16} /> Nieuwe factuur
        </Link>
      </div>

      {/* Primary insights — premium KPI cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, iconBg, iconColor, hint }) => (
          <div key={label} className="kpi-card">
            <div className={`kpi-icon ${iconBg}`}>
              <Icon size={20} className={iconColor} />
            </div>
            <p className="mt-6 text-3xl sm:text-[2rem] font-black tracking-tight text-gray-900 leading-none">
              {value}
            </p>
            <p className="mt-3 text-sm font-semibold text-gray-700">{label}</p>
            <p className="mt-1 text-xs text-gray-400 leading-snug">{hint}</p>
          </div>
        ))}
      </div>

      {/* Meta strip */}
      <div className="flex flex-wrap gap-3 text-sm">
        {meta.map(({ label, value, icon: Icon }) => (
          <div key={label} className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-4 py-2 shadow-sm">
            <Icon size={14} className="text-gray-400" />
            <span className="text-gray-500">{label}:</span>
            <span className="font-bold text-gray-900">{value}</span>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {(draftCount > 0 || overdueCount > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {overdueCount > 0 && (
            <Link
              href="/invoices?status=OVERDUE"
              className="group flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 hover:bg-red-100 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>
                  <strong>{overdueCount} factu{overdueCount !== 1 ? "ren" : "ur"}</strong> te laat met betaling ({formatEuro(overdueAmount)})
                </span>
              </span>
              <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          )}
          {draftCount > 0 && (
            <Link
              href="/invoices?status=DRAFT"
              className="group flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 hover:bg-orange-100 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <BellRing size={16} />
                <span>
                  <strong>{draftCount} concept{draftCount > 1 ? "en" : ""}</strong> nog niet verzonden
                </span>
              </span>
              <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          )}
        </div>
      )}

      {/* Recent invoices */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-8 py-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Recente facturen</h2>
            <p className="text-sm text-gray-500 mt-1">De laatste 5 aangemaakte facturen</p>
          </div>
          <Link href="/invoices" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">
            Alle facturen <ArrowUpRight size={14} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <FileText size={22} className="text-blue-600" />
            </div>
            <p className="text-base font-bold text-gray-900">Nog geen facturen</p>
            <p className="text-sm text-gray-500 mt-1 mb-5">Maak je eerste factuur in minder dan een minuut.</p>
            <Link href="/invoices/new" className="btn-primary">
              <Plus size={16} /> Eerste factuur maken
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 bg-gray-50/50">
                <th className="px-8 py-4 text-left font-semibold">Nummer</th>
                <th className="px-8 py-4 text-left font-semibold">Klant</th>
                <th className="px-8 py-4 text-left font-semibold">Datum</th>
                <th className="px-8 py-4 text-left font-semibold">Status</th>
                <th className="px-8 py-4 text-right font-semibold">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((inv) => {
                const eff = effectiveStatus({
                  status: inv.status as InvoiceStatus,
                  dueDate: inv.dueDate.toISOString(),
                  issueDate: inv.issueDate.toISOString(),
                });
                const od = daysOverdue({
                  status: inv.status as InvoiceStatus,
                  dueDate: inv.dueDate.toISOString(),
                  issueDate: inv.issueDate.toISOString(),
                });
                return (
                  <tr
                    key={inv.id}
                    className={`border-b border-gray-50 transition-colors ${
                      eff === "OVERDUE" ? "bg-red-50/40 hover:bg-red-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-8 py-5">
                      <Link href={`/invoices/${inv.id}`} className="font-mono font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 text-gray-700">{inv.client.name}</td>
                    <td className="px-6 py-3.5 text-gray-500 text-xs">{formatDate(inv.issueDate)}</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[eff]}`}>
                          {STATUS_LABELS[eff]}
                        </span>
                        {eff === "OVERDUE" && (
                          <span className="text-xs font-semibold text-red-600">+{od}d</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-gray-900">{formatEuro(inv.total)}</td>
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
