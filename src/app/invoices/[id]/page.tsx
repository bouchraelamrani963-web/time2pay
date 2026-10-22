import { hasPaidSubscription } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import InvoiceView from "@/components/InvoiceView";
import SendInvoiceButton from "@/components/SendInvoiceButton";
import type { Invoice } from "@/types/invoice";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const canExport = await hasPaidSubscription(user.uid);
  const raw = await prisma.invoice.findFirst({
    where: { id: params.id, userId: user.uid },
    include: { client: true, items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!raw) notFound();

  const invoice = {
    ...raw,
    status: raw.status as Invoice["status"],
    issueDate: raw.issueDate.toISOString(),
    dueDate: raw.dueDate.toISOString(),
    paidAt: raw.paidAt ? raw.paidAt.toISOString() : null,
    reminderSentAt: raw.reminderSentAt ? raw.reminderSentAt.toISOString() : null,
    reminderCount: raw.reminderCount,
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
  } as Invoice;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-[#726671] hover:text-[#33243b]">
          <ChevronLeft size={16} /> Terug naar facturen
        </Link>
        <SendInvoiceButton canExport={canExport} invoiceId={invoice.id} clientEmail={invoice.client.email} status={invoice.status} />
      </div>
      <InvoiceView invoice={invoice} canExport={canExport} />
    </div>
  );
}
