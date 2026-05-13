import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcInvoiceTotals } from "@/lib/calculations";
import { z } from "zod";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { client: true, items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(invoice);
  } catch {
    return NextResponse.json({ error: "Failed to fetch invoice" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const data = UpdateInvoiceSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.clientId) updateData.clientId = data.clientId;
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

      await prisma.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
      await prisma.invoiceItem.createMany({
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
    } else if (data.vatRate !== undefined) {
      updateData.vatRate = data.vatRate;
    }

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: updateData,
      include: { client: true, items: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json(invoice);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.invoice.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
}
