import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mollieApi } from "@/lib/mollie-connect";

export const runtime = "nodejs";
type Payment = { id: string; status: string; mode: string; profileId: string;
  amount: { currency: string; value: string }; paidAt?: string | null };
type PaymentList = { _embedded?: { payments?: { id: string }[] };
  _links?: { next?: { href: string } | null } };

// Mollie's legacy webhook sends only a transaction id, not a signed status.
// This endpoint re-fetches the payment using the merchant's token and verifies
// membership in the exact payment link before making any invoice changes.
export async function POST(request: Request, { params }: { params: { key: string } }) {
  if (!/^[a-f0-9]{64}$/.test(params.key)) return new NextResponse(null, { status: 404 });
  const link = await prisma.invoicePaymentLink.findUnique({ where: { webhookKey: params.key } });
  if (!link?.paymentLinkId || !link.url) return new NextResponse(null, { status: 404 });
  const body = await request.text();
  if (body.length > 2048) return new NextResponse(null, { status: 413 });
  const id = new URLSearchParams(body).get("id") || "";
  if (!/^tr_[A-Za-z0-9]+$/.test(id)) return new NextResponse(null, { status: 400 });
  try {
    const modeQuery = link.mode === "test" ? "?testmode=true" : "";
    const payment = await mollieApi<Payment>(link.userId,
      "/v2/payments/" + encodeURIComponent(id) + modeQuery);
    if (payment.id !== id || payment.mode !== link.mode || payment.profileId !== link.profileId ||
      payment.amount.currency !== "EUR" ||
      Math.round(Number(payment.amount.value) * 100) !== link.amountCents) {
      return new NextResponse(null, { status: 400 });
    }
    const paymentList = await mollieApi<PaymentList>(link.userId,
      "/v2/payment-links/" + encodeURIComponent(link.paymentLinkId) + "/payments?limit=250" +
      (link.mode === "test" ? "&testmode=true" : ""));
    if (!paymentList._embedded?.payments?.some(item => item.id === id)) {
      // Retry: provider data may not have become consistent yet.
      return new NextResponse(null, { status: 503 });
    }
    if (payment.status === "paid") {
      const invoice = await prisma.invoice.findFirst({ where: { id: link.invoiceId, userId: link.userId } });
      if (!invoice || Math.round(invoice.total * 100) !== link.amountCents) {
        return new NextResponse(null, { status: 409 });
      }
      await prisma.invoice.updateMany({
        where: { id: link.invoiceId, userId: link.userId, status: { in: ["SENT", "OVERDUE"] } },
        data: { status: "PAID", paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date() },
      });
    }
    return new NextResponse(null, { status: 200 });
  } catch {
    // Non-2xx asks Mollie to retry; never mark invoices paid on errors.
    return new NextResponse(null, { status: 503 });
  }
}
