import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { processBillingEvent } from "@/lib/billing-webhook";
import { dispatchBillingNotices } from "@/lib/billing-notice-dispatch";
import { getBillingEnvironment } from "@/lib/billing-environment";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  let event: Stripe.Event;
  let stripe: ReturnType<typeof getStripe>;
  let configuration: ReturnType<typeof getBillingEnvironment>;
  try {
    configuration = getBillingEnvironment();
    stripe = getStripe();
    const secret = configuration.webhookSecret;
    const signature = req.headers.get("stripe-signature");
    if (!secret || !signature) throw new Error("Webhookconfiguratie ontbreekt");
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
    if (event.livemode !== configuration.livemode) throw new Error("Verkeerde webhookomgeving");
    if ((await stripe.accounts.retrieveCurrent()).id !== configuration.accountId) throw new Error("Verkeerde Stripe-account");
  } catch {
    return NextResponse.json({ error: "Ongeldige webhook" }, { status: 400 });
  }
  try {
    await processBillingEvent(event, stripe, prisma, configuration);
    await dispatchBillingNotices();
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook verwerken mislukt" }, { status: 500 });
  }
}
