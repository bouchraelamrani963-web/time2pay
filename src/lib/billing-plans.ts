export const BILLING_PLANS = {
  starter: { name: "Starter", cents: 900, priceId: "price_1UTMKLITnweMFGCgJdeTu8jS" },
  pro: { name: "Pro", cents: 1900, priceId: "price_1UTMKqITnweMFGCg55kyL7v5" },
  business: { name: "Business", cents: 3900, priceId: "price_1UTMLHITnweMFGCgOCtomBjz" },
} as const;
export type BillingPlan = keyof typeof BILLING_PLANS;
export function isBillingPlan(value: unknown): value is BillingPlan {
  return typeof value === "string" && Object.hasOwn(BILLING_PLANS, value);
}

// No trial access: only a paid, active, current subscription grants export/send.
export function grantsPaidAccess(input: {
  livemode: boolean; status: string; invoicePaid: boolean;
  priceId: string; periodEnd: number;
}, now = Date.now(), policy = { livemode: false, priceIds: Object.values(BILLING_PLANS).map(plan => plan.priceId) as string[] }) {
  return input.livemode === policy.livemode && input.status === "active" && input.invoicePaid &&
    policy.priceIds.includes(input.priceId) &&
    input.periodEnd * 1000 > now;
}
