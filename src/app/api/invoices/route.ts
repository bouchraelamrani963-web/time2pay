import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcInvoiceTotals, generateInvoiceNumber } from "@/lib/calculations";
import { z } from "zod";

const ItemSchema = z.object({
  type: z.enum(["HOURS", "M2", "MATERIAL", "FIXED"]),
  description: z.string().min(1),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  unit: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

const CreateInvoiceSchema = z.object({
  clientId: z.string().min(1),
  dueDate: z.string(),
  notes: z.string().optional(),
  vatRate: z.number().min(0).max(100).default(21),
  items: z.array(ItemSchema).min(1),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");

    const invoices = await prisma.invoice.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(clientId ? { clientId } : {}),
      },
      include: { client: true, items: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(invoices);
  } catch {
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = CreateInvoiceSchema.parse(body);

    const { subtotal, vatAmount, total } = calcInvoiceTotals(data.items, data.vatRate);

    const invoice = await prisma.invoice.create({
      data: {
        number: generateInvoiceNumber(),
        clientId: data.clientId,
        dueDate: new Date(data.dueDate),
        notes: data.notes || null,
        vatRate: data.vatRate,
        subtotal,
        vatAmount,
        total,
        items: {
          create: data.items.map((item) => {
            const lineTotal =
              item.type === "FIXED"
                ? item.unitPrice
                : Math.round(item.quantity * item.unitPrice * 100) / 100;
            return {
              type: item.type,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unit: item.unit || null,
              lineTotal,
              sortOrder: item.sortOrder,
            };
          }),
        },
      },
      include: { client: true, items: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
