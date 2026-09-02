import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { calcInvoiceTotals } from "@/lib/calculations";
import { z } from "zod";

export const runtime = "nodejs";

const ItemSchema = z.object({
  type: z.enum(["HOURS", "M2", "MATERIAL", "FIXED"]),
  description: z.string().min(1),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  unit: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

const UpdateInvoiceSchema = z.object({
  clientId: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional().nullable(),
  vatRate: z.number().min(0).max(100).optional(),
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  items: z.array(ItemSchema).optional(),
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

    const updateData: Prisma.InvoiceUncheckedUpdateManyInput = {};
    if (data.clientId) {
      const ownedClient = await prisma.client.findFirst({
        where: { id: data.clientId, userId: user.uid },
        select: { id: true },
      });
      if (!ownedClient) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
      updateData.clientId = data.clientId;
    }
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status) updateData.status = data.status;

    if (data.items !== undefined) {
      const vatRate = data.vatRate ?? 21;
      const { subtotal, vatAmount, total } = calcInvoiceTotals(data.items, vatRate);
      updateData.vatRate = vatRate;
      updateData.subtotal = subtotal;
      updateData.vatAmount = vatAmount;
      updateData.total = total;

    } else if (data.vatRate !== undefined) {
      updateData.vatRate = data.vatRate;
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.invoice.updateMany({
        where: { id: params.id, userId: user.uid },
        data: updateData,
      });

      if (updateResult.count === 0) return null;

      if (data.items !== undefined) {
        await tx.invoiceItem.deleteMany({
          where: {
            invoiceId: params.id,
            invoice: { is: { userId: user.uid } },
          },
        });
        await tx.invoiceItem.createMany({
          data: data.items.map((item) => {
            const lineTotal =
              item.type === "FIXED"
                ? item.unitPrice
                : Math.round(item.quantity * item.unitPrice * 100) / 100;
            return {
              invoiceId: params.id,
              type: item.type,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unit: item.unit || null,
              lineTotal,
              sortOrder: item.sortOrder,
            };
          }),
        });
      }

      return tx.invoice.findFirst({
        where: { id: params.id, userId: user.uid },
        include: { client: true, items: { orderBy: { sortOrder: "asc" } } },
      });
    });

    if (!invoice) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

    return NextResponse.json(invoice);
  } catch (err) {
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
