import { NextRequest, NextResponse } from "next/server";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { getStripe } from "@/lib/billing";
import { getBillingEnvironment, assertBillingOrigin } from "@/lib/billing-environment";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 403 });
  }
  try {
    const configuration = getBillingEnvironment();
    assertBillingOrigin(new URL(req.url), configuration.livemode);
    const stripe = getStripe();
    if ((await stripe.accounts.retrieveCurrent()).id !== configuration.accountId) throw new Error("Verkeerde Stripe-account");
    const account = await prisma.billingAccount.findUnique({ where: { userId: user.uid } });
    if (!account?.customerId) return NextResponse.json({ error: "Nog geen facturatieaccount" }, { status: 404 });
    const session = await stripe.billingPortal.sessions.create({
      customer: account.customerId, return_url: `${new URL(req.url).origin}/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Abonnement beheren is nog niet beschikbaar." }, { status: 503 });
  }
}
