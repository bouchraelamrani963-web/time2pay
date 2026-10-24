import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { getPaidEntitlement, paymentRequired } from "./billing";

// Count distinct invoices at their first definitive action, never draft creation.
// A failed provider send conservatively retains its reservation; retrying is free.
export async function authorizeInvoiceIssue(userId: string, invoiceId: string) {
  const entitlement = await getPaidEntitlement(userId);
  if (!entitlement) return paymentRequired();
  return prisma.$transaction(async tx => {
    // Shared account lock prevents the 30th and 31st simultaneous issue both passing.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, userId }, select: { id: true } });
    if (!invoice) return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
    const issued = await tx.invoiceIssue.findUnique({ where: { userId_invoiceId: { userId, invoiceId } } });
    if (issued) return null;
    const count = await tx.invoiceIssue.count({ where: { userId,
      subscriptionId: entitlement.subscriptionId, periodStart: entitlement.periodStart } });
    if (entitlement.starter && count >= 30) {
      return NextResponse.json({ code: "INVOICE_LIMIT_REACHED",
        error: "Je hebt de 30 facturen van je Starter-abonnementsperiode gebruikt. Concepten blijven gratis.",
      }, { status: 409 });
    }
    await tx.invoiceIssue.create({ data: { userId, invoiceId,
      subscriptionId: entitlement.subscriptionId, periodStart: entitlement.periodStart, periodEnd: entitlement.periodEnd } });
    return null;
  });
}
