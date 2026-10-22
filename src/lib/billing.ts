import "server-only";
import StripeClient from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { grantsPaidAccess } from "./billing-plans";

export const SANDBOX_ACCOUNT = "acct_1UTMA8ITnweMFGCg";
export function getStripe() {
  const key = process.env.STRIPE_TEST_RESTRICTED_KEY;
  if (process.env.TIME2PAY_BILLING_MODE !== "test" || process.env.VERCEL_ENV === "production" ||
      !key?.startsWith("rk_test_")) {
    throw new Error("Stripe-testconfiguratie ontbreekt of is niet toegestaan op productie.");
  }
  return new StripeClient(key);
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
export async function hasPaidSubscription(userId: string) {
  const account = await prisma.billingAccount.findUnique({ where: { userId } });
  if (!account?.subscriptionId || !account.customerId) return false;
  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(account.subscriptionId, { expand: ["latest_invoice"] });
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const invoice = sub.latest_invoice;
    const item = sub.items.data[0];
    return customerId === account.customerId && sub.items.data.length === 1 && !!item && grantsPaidAccess({
      livemode: sub.livemode,
      status: sub.status,
      invoicePaid: !!invoice && typeof invoice !== "string" && invoice.status === "paid" && invoice.amount_paid > 0,
      priceId: item.price.id,
      periodEnd: item.current_period_end,
    });
  } catch {
    return false;
  }
}
