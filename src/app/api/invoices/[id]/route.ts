import { NextRequest, NextResponse } from "next/server";
import { hasPaidSubscription, paymentRequired } from "@/lib/billing";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { calcOrtAmount, calcInvoiceTotals } from "@/lib/calculations";
import { InvoiceItemSchema, ortPermissionError } from "@/lib/shift-rates";
import { z } from "zod";

export const runtime = "nodejs";

const UpdateInvoiceSchema = z.object({
  ortAgreed: z.boolean().optional(),
  clientId: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional().nullable(),
  vatRate: z.number().min(0).max(100).optional(),
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  items: z.array(InvoiceItemSchema).min(1).max(100).optional(),
});

async function findOwnedInvoice(id: string, uid: string) {
  return prisma.invoice.findFirst({
    where: { id, userId: uid },
    select: { id: true },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: params.id, userId: user.uid },
      include: { client: true, items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!invoice) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    return NextResponse.json(invoice);
  } catch {
    return NextResponse.json({ error: "Factuur ophalen mislukt" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;

  try {
    const ownedInvoice = await findOwnedInvoice(params.id, user.uid);
    if (!ownedInvoice) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

    const body = await req.json();
    const data = UpdateInvoiceSchema.parse(body);
    if (data.items?.some(item => item.type !== "HOURS" && item.ortPerc !== 0)) {
      return NextResponse.json({ error: "ORT is alleen toegestaan voor uren." }, { status: 422 });
    }
    if (data.status && data.status !== "DRAFT" && !await hasPaidSubscription(user.uid)) return paymentRequired();

    const invoice = await prisma.$transaction(async tx => {
      const current = await tx.invoice.findFirst({ where: { id: params.id, userId: user.uid }, include: { items: true } });
      if (!current) return null;
      const changingPricing = data.items !== undefined || data.clientId !== undefined || data.vatRate !== undefined || data.ortAgreed !== undefined;
      if (changingPricing && current.status !== "DRAFT") throw new Error("FINAL_PRICING_LOCKED");
      const targetClientId = data.clientId ?? current.clientId;
      const client = await tx.client.findFirst({ where: { id: targetClientId, userId: user.uid }, select: { id: true, ortAgreed: true } });
      if (!client) throw new Error("CLIENT_NOT_FOUND");
      const ortAgreed = data.ortAgreed ?? (targetClientId === current.clientId ? current.ortAgreed : false);
      const items = data.items ?? current.items;
      if (changingPricing) {
        const error = ortPermissionError(items, ortAgreed, client.ortAgreed);
        if (error) throw new Error("ORT_NOT_AGREED");
      }
      const updateData: Prisma.InvoiceUncheckedUpdateManyInput = {};
      if (data.clientId !== undefined) updateData.clientId = targetClientId;
      if (data.ortAgreed !== undefined || data.clientId !== undefined) updateData.ortAgreed = ortAgreed;
      if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.status) updateData.status = data.status;
      if (data.items !== undefined || data.vatRate !== undefined) {
        const vatRate = data.vatRate ?? current.vatRate;
        const totals = calcInvoiceTotals(items.map(item => ({ ...item, unit: item.unit ?? undefined })), vatRate);
        Object.assign(updateData, { vatRate, subtotal: totals.subtotal, vatAmount: totals.vatAmount, total: totals.total });
      }
      const updated = await tx.invoice.updateMany({ where: { id: params.id, userId: user.uid }, data: updateData });
      if (!updated.count) return null;
      if (data.items !== undefined) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: params.id, invoice: { is: { userId: user.uid } } } });
        await tx.invoiceItem.createMany({ data: data.items.map(item => ({
          invoiceId: params.id, type: item.type, description: item.description, quantity: item.quantity,
          unitPrice: item.unitPrice, unit: item.unit || null,
          serviceType: item.type === "HOURS" ? (item.serviceType ?? "DAY") : null,
          lineTotal: calcInvoiceTotals([item], 0).items[0].lineTotal,
          ortPerc: item.ortPerc, ortBedrag: calcOrtAmount(item), sortOrder: item.sortOrder,
        })) });
      }
      return tx.invoice.findFirst({ where: { id: params.id, userId: user.uid }, include: { client: true, items: { orderBy: { sortOrder: "asc" } } } });
    });

    if (!invoice) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

    return NextResponse.json(invoice);
  } catch (err) {
    if (err instanceof Error && err.message === "CLIENT_NOT_FOUND") return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
    if (err instanceof Error && err.message === "FINAL_PRICING_LOCKED") return NextResponse.json({ error: "Tarieven van een definitieve factuur kunnen niet worden gewijzigd." }, { status: 409 });
    if (err instanceof Error && err.message === "ORT_NOT_AGREED") return NextResponse.json({ error: "ORT vereist een vastgelegde klantafspraak en bevestiging op deze factuur." }, { status: 422 });
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    return NextResponse.json({ error: "Factuur bijwerken mislukt" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;

  try {
    const ownedInvoice = await findOwnedInvoice(params.id, user.uid);
    if (!ownedInvoice) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

    const deleteResult = await prisma.invoice.deleteMany({
      where: { id: params.id, userId: user.uid },
    });

    if (deleteResult.count === 0) {
      return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
