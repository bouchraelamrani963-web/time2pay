import { authorizeInvoiceIssue } from "@/lib/invoice-issuance";
import { NextResponse } from "next/server";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { hasPaidSubscription, paymentRequired } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { buildInvoicePdf, getInvoicePdfFilename } from "@/lib/invoice-pdf";

export const runtime = "nodejs";
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;
  if (!await hasPaidSubscription(user.uid)) return paymentRequired();
  const denied = await authorizeInvoiceIssue(user.uid, params.id);
  if (denied) return denied;
  const invoice = await prisma.invoice.findFirst({ where: { id: params.id, userId: user.uid },
    include: { client: true, items: { orderBy: { sortOrder: "asc" } } } });
  if (!invoice) return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  const company = await prisma.companySettings.findUnique({ where: { userId: user.uid } });
  const pdf = buildInvoicePdf(invoice, company?.companyName || user.name || "Time2Pay", company);
  return new NextResponse(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf", "Cache-Control": "private, no-store",
    "Content-Disposition": `inline; filename="${getInvoicePdfFilename(invoice.number)}"`,
  } });
}
