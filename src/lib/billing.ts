import "server-only";
import StripeClient from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { grantsPaidAccess } from "./billing-plans";
import { getBillingEnvironment } from "./billing-environment";

export { SANDBOX_ACCOUNT } from "./billing-environment";
export function getStripe() {
  return new StripeClient(getBillingEnvironment().key);
}

export function paymentRequired() {
  return NextResponse.json({
    code: "SUBSCRIPTION_REQUIRED",
    error: "Kies een betaald abonnement om facturen te verzenden, als PDF te downloaden of af te drukken.",
    upgradeUrl: "/billing",
  }, { status: 402 });
}

// Always refresh Stripe state. An old webhook or cancelled/failed renewal cannot
// leave access enabled in a stale local cache. Stripe outages fail closed.
export async function getPaidEntitlement(userId: string) {
  const account = await prisma.billingAccount.findUnique({ where: { userId } });
  if (!account?.subscriptionId || !account.customerId) return null;
  try {
    const configuration = getBillingEnvironment();
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(account.subscriptionId, { expand: ["latest_invoice"] });
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const invoice = sub.latest_invoice;
    const item = sub.items.data[0];
    const valid = customerId === account.customerId && sub.items.data.length === 1 && !!item && grantsPaidAccess({
      livemode: sub.livemode,
      status: sub.status,
      invoicePaid: !!invoice && typeof invoice !== "string" && invoice.status === "paid" && invoice.amount_paid > 0,
      priceId: item.price.id,
      periodEnd: item.current_period_end,
    }, Date.now(), { livemode: configuration.livemode,
      priceIds: Object.values(configuration.plans).map(plan => plan.priceId) });
    if (!valid) return null;
    return { subscriptionId: sub.id, periodStart: item.current_period_start,
      periodEnd: item.current_period_end, starter: item.price.id === configuration.plans.starter.priceId };
  } catch {
    return null;
  }
}

export async function hasPaidSubscription(userId: string) {
  return !!await getPaidEntitlement(userId);
}

// Display only; permissions never depend on this value or a webhook cache.
export async function getBillingStatus(userId: string): Promise<string | null> {
  const account = await prisma.billingAccount.findUnique({ where: { userId } });
  if (!account?.subscriptionId || !account.customerId) return null;
  try {
    const sub = await getStripe().subscriptions.retrieve(account.subscriptionId);
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    if (sub.livemode !== getBillingEnvironment().livemode || customerId !== account.customerId) return null;
    return sub.status;
  } catch { return null; }
}

