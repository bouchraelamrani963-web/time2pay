import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import InvoiceView from "@/components/InvoiceView";
import type { Invoice } from "@/types/invoice";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const raw = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { client: true, items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!raw) notFound();

  const invoice: Invoice = {
    ...raw,
    status: raw.status as Invoice["status"],
    issueDate: raw.issueDate.toISOString(),
    dueDate: raw.dueDate.toISOString(),
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    client: {
      ...raw.client,
      createdAt: raw.client.createdAt.toISOString(),
      updatedAt: raw.client.updatedAt.toISOString(),
    },
    items: raw.items.map((item) => ({
      ...item,
      type: item.type as Invoice["items"][0]["type"],
    })),
  };

  return (
    <div className="space-y-6">
      <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ChevronLeft size={16} /> Terug naar facturen
      </Link>
      <InvoiceView invoice={invoice} />
    </div>
  );
}
