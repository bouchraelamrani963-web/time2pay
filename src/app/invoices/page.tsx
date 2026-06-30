import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS } from "@/types/invoice";
import type { InvoiceStatus } from "@/types/invoice";

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { status?: string; clientId?: string };
}) {
  const user = await requireUser();
  const status = searchParams.status as InvoiceStatus | undefined;
  const clientId = searchParams.clientId;

  const invoices = await prisma.invoice.findMany({
    where: {
      userId: user.uid,
      ...(status ? { status } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });

  const statuses: (InvoiceStatus | "all")[] = ["all", "DRAFT", "SENT", "PAID", "OVERDUE"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturen</h1>
          <p className="text-sm text-gray-500">{invoices.length} factuur{invoices.length !== 1 ? "en" : ""}</p>
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
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              (s === "all" && !status) || s === status
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "all" ? "Alle" : STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        {invoices.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">
            Geen facturen gevonden.{" "}
            <Link href="/invoices/new" className="text-blue-600 underline">Maak er een aan</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="px-6 py-3 text-left font-medium">Nummer</th>
                <th className="px-6 py-3 text-left font-medium">Klant</th>
                <th className="px-6 py-3 text-left font-medium">Datum</th>
                <th className="px-6 py-3 text-left font-medium">Vervalt</th>
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
                  <td className="px-6 py-3 text-gray-500">{formatDate(inv.issueDate)}</td>
                  <td className="px-6 py-3 text-gray-500">{formatDate(inv.dueDate)}</td>
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
