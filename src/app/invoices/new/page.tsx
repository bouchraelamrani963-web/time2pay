import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronLeft, UserPlus } from "lucide-react";
import InvoiceBuilder from "@/components/InvoiceBuilder";
import type { Client } from "@/types/invoice";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const rawClients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  const clients: Client[] = rawClients.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  const initialClientId =
    searchParams.clientId && clients.some((c) => c.id === searchParams.clientId)
      ? searchParams.clientId
      : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
            <ChevronLeft size={16} /> Terug naar facturen
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Nieuwe factuur</h1>
          {clients.length === 0 && (
            <p className="mt-2 text-sm text-orange-600">
              Voeg eerst een klant toe.{" "}
              <Link href="/clients/new?returnTo=invoice" className="underline font-semibold">
                Klant aanmaken
              </Link>
            </p>
          )}
        </div>
        {clients.length > 0 && (
          <Link href="/clients/new?returnTo=invoice" className="btn-secondary">
            <UserPlus size={15} /> Nieuwe klant
          </Link>
        )}
      </div>
      <InvoiceBuilder clients={clients} initialClientId={initialClientId} />
    </div>
  );
}
