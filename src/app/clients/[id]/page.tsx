import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Edit3, FileText, Plus } from "lucide-react";
import { STATUS_COLORS, STATUS_LABELS } from "@/types/invoice";
import type { InvoiceStatus } from "@/types/invoice";
import { effectiveStatus } from "@/lib/invoice-status";
import DeleteClientButton from "@/components/DeleteClientButton";

function formatEuro(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDate(value: Date) {
  return value.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#92858d]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[#33243b] whitespace-pre-line">{value || "-"}</dd>
    </div>
  );
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const client = await prisma.client.findFirst({
    where: { id: params.id, userId: user.uid },
    include: {
      invoices: {
        where: { userId: user.uid },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          issueDate: true,
          dueDate: true,
          total: true,
        },
      },
    },
  });

  if (!client) notFound();

  const totalInvoiced = client.invoices.reduce((sum, invoice) => sum + invoice.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-[#726671] hover:text-[#33243b]">
            <ChevronLeft size={16} /> Terug naar klanten
          </Link>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[#33243b]">{client.name}</h1>
          <p className="mt-1 text-sm text-[#726671]">
            {client.invoices.length} factuur{client.invoices.length !== 1 ? "en" : ""} gekoppeld aan deze klant
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={`/clients/${client.id}/edit`} className="btn-secondary">
            <Edit3 size={15} /> Klant bewerken
          </Link>
          <Link href={`/invoices/new?clientId=${client.id}`} className="btn-primary">
            <Plus size={15} /> Nieuwe factuur voor deze klant
          </Link>
          <DeleteClientButton clientId={client.id} clientName={client.name} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card p-6">
          <div className="mb-6 flex items-center justify-between border-b border-[#eee5e1] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#33243b]">Klantgegevens</h2>
              <p className="text-sm text-[#726671]">Contact- en facturatiegegevens</p>
            </div>
          </div>

          <dl className="grid gap-5 sm:grid-cols-2">
            <DetailRow label="Naam" value={client.name} />
            <DetailRow label="E-mail" value={client.email} />
            <DetailRow label="Telefoon" value={client.phone} />
            <DetailRow label="BTW-nummer" value={client.vatNumber} />
            <div className="sm:col-span-2">
              <DetailRow label="Adres" value={client.address} />
            </div>
          </dl>
        </section>

        <aside className="card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f8f0eb] text-[#543749]">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#726671]">Totaal gefactureerd</p>
              <p className="text-2xl font-semibold tracking-tight text-[#33243b]">{formatEuro(totalInvoiced)}</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[#eee5e1] pt-5 text-sm">
            <div>
              <p className="text-[#726671]">Facturen</p>
              <p className="mt-1 text-lg font-bold text-[#33243b]">{client.invoices.length}</p>
            </div>
            <div>
              <p className="text-[#726671]">Klant sinds</p>
              <p className="mt-1 text-lg font-bold text-[#33243b]">{formatDate(client.createdAt)}</p>
            </div>
          </div>
        </aside>
      </div>

      <section className="card overflow-x-auto">
        <div className="flex items-center justify-between border-b border-[#eee5e1] px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-[#33243b]">Facturen</h2>
            <p className="text-sm text-[#726671]">Alle facturen voor {client.name}</p>
          </div>
          <Link href={`/invoices/new?clientId=${client.id}`} className="btn-secondary">
            <Plus size={15} /> Nieuwe factuur
          </Link>
        </div>

        {client.invoices.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#726671]">
            Nog geen facturen voor deze klant. {" "}
            <Link href={`/invoices/new?clientId=${client.id}`} className="font-semibold text-[#543749] underline">
              Maak de eerste factuur aan
            </Link>
          </div>
        ) : (
          <table className="w-full min-w-[630px] text-sm">
            <thead>
              <tr className="border-b border-[#eee5e1] text-xs text-[#726671]">
                <th className="px-6 py-3 text-left font-medium">Nummer</th>
                <th className="px-6 py-3 text-left font-medium">Datum</th>
                <th className="px-6 py-3 text-left font-medium">Vervalt</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {client.invoices.map((invoice) => {
                const status = effectiveStatus({
                  status: invoice.status as InvoiceStatus,
                  dueDate: invoice.dueDate,
                  issueDate: invoice.issueDate,
                });

                return (
                  <tr key={invoice.id} className="border-b border-gray-50 hover:bg-[#fbf8f5]">
                    <td className="px-6 py-3">
                      <Link href={`/invoices/${invoice.id}`} className="font-mono font-semibold text-[#543749] hover:underline">
                        {invoice.number}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-[#726671]">{formatDate(invoice.issueDate)}</td>
                    <td className="px-6 py-3 text-[#726671]">{formatDate(invoice.dueDate)}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-[#33243b]">{formatEuro(invoice.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
