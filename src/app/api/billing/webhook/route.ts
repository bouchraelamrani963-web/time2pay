import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
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
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      if (session.mode === "subscription" && session.payment_status === "paid" &&
          typeof session.customer === "string" && typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        const userId = session.metadata?.time2payUserId;
        const item = subscription.items.data[0];
        if (subscription.livemode === configuration.livemode && userId && customerId === session.customer &&
            session.client_reference_id === userId && subscription.metadata.time2payUserId === userId &&
            subscription.items.data.length === 1 && Object.values(configuration.plans).some(plan => plan.priceId === item?.price.id)) {
          // Customer mapping was created by our authenticated checkout endpoint.
          // Never grant access based on a customer ID supplied by the browser.
          await prisma.billingAccount.updateMany({ where: { userId, customerId },
            data: { subscriptionId: subscription.id } });
        }
      }
    }
    // Renewals, failures and cancellations are checked against current Stripe
    // state on every protected operation, so event reordering cannot regrant access.
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook verwerken mislukt" }, { status: 500 });
  }
}
