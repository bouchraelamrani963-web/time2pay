import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, hasPaidSubscription } from "@/lib/billing";
import { getBillingEnvironment, assertBillingOrigin } from "@/lib/billing-environment";
import { BILLING_PLANS, isBillingPlan } from "@/lib/billing-plans";
import { getRegistrationTrial } from "@/lib/registration-trial";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!isBillingPlan(body?.plan)) return NextResponse.json({ error: "Ongeldig abonnement" }, { status: 422 });
  const planKey = body.plan as keyof typeof BILLING_PLANS;
  try {
    if (await getRegistrationTrial(user.uid)) {
      return NextResponse.json({ code: "TRIAL_ACTIVE", error: "Je gebruikt Time2Pay nog gratis. Kies na je gratis periode zelf een abonnement; er wordt niets automatisch afgeschreven." }, { status: 409 });
    }
    const configuration = getBillingEnvironment();
    const plan = configuration.plans[planKey];
    assertBillingOrigin(new URL(req.url), configuration.livemode);
    const stripe = getStripe();
    const stripeAccount = await stripe.accounts.retrieveCurrent();
    if (stripeAccount.id !== configuration.accountId) throw new Error("Verkeerde Stripe-account");
    const price = await stripe.prices.retrieve(plan.priceId);
    if (price.livemode !== configuration.livemode || !price.active || price.currency !== "eur" || price.unit_amount !== plan.cents ||
        price.tax_behavior !== "inclusive" || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1) {
      throw new Error("Prijscontrole mislukt");
    }
    const registrations = await stripe.tax.registrations.list({ status: "active", limit: 100 });
    if (!registrations.data.some(reg => reg.livemode === configuration.livemode && reg.country === "NL")) {
      throw new Error("Nederlandse belastingregistratie ontbreekt");
    }
    if (await hasPaidSubscription(user.uid)) {
      return NextResponse.json({ error: "Je hebt al een betaald abonnement." }, { status: 409 });
    }
    await prisma.billingAccount.createMany({ data: [{ userId: user.uid }], skipDuplicates: true });
    let account = await prisma.billingAccount.findUniqueOrThrow({ where: { userId: user.uid } });
    if (!account.customerId) {
      const customer = await stripe.customers.create({ metadata: { time2payUserId: user.uid } },
        { idempotencyKey: `time2pay-customer-${user.uid}` });
      account = await prisma.billingAccount.update({ where: { userId: user.uid }, data: { customerId: customer.id } });
    }
    // Do not create duplicate subscriptions when checkout is clicked twice or
    // payment is still pending. Reuse an open session for the selected plan.
    const subscriptions = await stripe.subscriptions.list({ customer: account.customerId!, status: "all", limit: 100 });
    if (subscriptions.data.some(sub => !["canceled", "incomplete_expired"].includes(sub.status))) {
      return NextResponse.json({ error: "Er bestaat al een abonnement of een betaling in behandeling." }, { status: 409 });
    }
    const sessions = await stripe.checkout.sessions.list({ customer: account.customerId!, status: "open", limit: 100 });
    const existing = sessions.data.find(session => session.metadata?.plan === planKey && session.mode === "subscription");
    if (existing?.url) return NextResponse.json({ url: existing.url });
    if (sessions.data.some(session => session.mode === "subscription")) {
      return NextResponse.json({ error: "Je hebt al een open afrekenpagina. Rond deze af of laat deze verlopen voordat je een ander abonnement kiest." }, { status: 409 });
    }
    const origin = new URL(req.url).origin;
    const bucket = Math.floor(Date.now() / 1800000);
    // A new purchase after cancellation must not reuse a completed checkout.
    const previousSubscriptionId = subscriptions.data[0]?.id ?? "new";
    const attemptKey = `${user.uid}-${planKey}-${previousSubscriptionId}-${bucket}`;
    const suffix = createHash("sha256").update(attemptKey).digest("hex").slice(0, 8)
      .split("").map(char => String.fromCharCode(97 + parseInt(char, 16))).join("");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: account.customerId!,
      client_reference_id: user.uid,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      tax_id_collection: { enabled: true },
      metadata: { time2payUserId: user.uid, plan: planKey },
      subscription_data: { metadata: { time2payUserId: user.uid } },
      success_url: `${origin}/billing?result=success`,
      cancel_url: `${origin}/billing?result=cancelled`,
      integration_identifier: `time2pay_${suffix}`,
    }, { idempotencyKey: `time2pay-checkout-${attemptKey}` });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Betalen is nog niet beschikbaar. Probeer het later opnieuw." }, { status: 503 });
  }
}
