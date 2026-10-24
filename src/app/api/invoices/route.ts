import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { calcOrtAmount, calcInvoiceTotals, generateInvoiceNumber } from "@/lib/calculations";
import { effectiveStatus } from "@/lib/invoice-status";
import type { InvoiceStatus } from "@/types/invoice";
import { InvoiceItemSchema, ortPermissionError } from "@/lib/shift-rates";
import { z } from "zod";

export const runtime = "nodejs";

const CreateInvoiceSchema = z.object({
  ortAgreed: z.boolean().default(false),
  clientId: z.string().min(1),
  dueDate: z.string(),
  notes: z.string().optional(),
  vatRate: z.number().min(0).max(100).default(21),
  items: z.array(InvoiceItemSchema).min(1).max(100),
});

export async function GET(req: NextRequest) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");

    const invoices = await prisma.invoice.findMany({
      where: {
        userId: user.uid,
        ...(clientId ? { clientId } : {}),
      },
      include: { client: true, items: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    const filteredInvoices = status
      ? invoices.filter((invoice) => effectiveStatus({
          status: invoice.status as InvoiceStatus,
          dueDate: invoice.dueDate,
          issueDate: invoice.issueDate,
        }) === status)
      : invoices;

    return NextResponse.json(filteredInvoices);
  } catch {
    return NextResponse.json({ error: "Facturen ophalen mislukt" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;

  try {
    const body = await req.json();
    const data = CreateInvoiceSchema.parse(body);
    if (data.items?.some(item => item.type !== "HOURS" && item.ortPerc !== 0)) {
      return NextResponse.json({ error: "ORT is alleen toegestaan voor uren." }, { status: 422 });
    }

    const ownedClient = await prisma.client.findFirst({
      where: { id: data.clientId, userId: user.uid },
      select: { id: true, ortAgreed: true },
    });

    if (!ownedClient) {
      return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
    }

    const ortError = ortPermissionError(data.items, data.ortAgreed, ownedClient.ortAgreed);
    if (ortError) return NextResponse.json({ error: ortError }, { status: 422 });

    const { subtotal, vatAmount, total } = calcInvoiceTotals(data.items, data.vatRate);

    const invoice = await prisma.$transaction(async (tx) => {
      return tx.invoice.create({
      data: {
        userId: user.uid,
        number: generateInvoiceNumber(),
        clientId: data.clientId,
        ortAgreed: data.ortAgreed,
        dueDate: new Date(data.dueDate),
        notes: data.notes || null,
        vatRate: data.vatRate,
        subtotal,
        vatAmount,
        total,
        items: {
          create: data.items.map((item) => {
            const lineTotal = calcInvoiceTotals([item], 0).items[0].lineTotal;
            const ortBedrag = calcOrtAmount(item);
            return {
              type: item.type,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unit: item.unit || null,
              lineTotal,
              serviceType: item.type === "HOURS" ? (item.serviceType ?? "DAY") : null,
              ortPerc: item.type === "HOURS" ? item.ortPerc : 0,
              ortBedrag,
              sortOrder: item.sortOrder,
            };
          }),
        },
      },
      include: { client: true, items: { orderBy: { sortOrder: "asc" } } },
      });
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: "Factuur aanmaken mislukt" }, { status: 500 });
  }
}
