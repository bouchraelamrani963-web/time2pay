import "server-only";
import { BILLING_PLANS, type BillingPlan } from "./billing-plans";

type Environment = Record<string, string | undefined>;
export const SANDBOX_ACCOUNT = "acct_1UTMA8ITnweMFGCg";
const planKeys: BillingPlan[] = ["starter", "pro", "business"];

// Reading configuration never creates a customer, subscription or payment.
// Live configuration and permission to create live payments are separate gates.
export function resolveBillingEnvironment(env: Environment, requireActivation = true) {
  if (env.VERCEL_ENV !== "production") {
    const key = env.STRIPE_TEST_RESTRICTED_KEY;
    if (env.TIME2PAY_BILLING_MODE !== "test" || !key?.startsWith("rk_test_")) {
      throw new Error("Billing configuration unavailable");
    }
    return { key, livemode: false, accountId: SANDBOX_ACCOUNT,
      plans: BILLING_PLANS, webhookSecret: env.STRIPE_TEST_WEBHOOK_SECRET };
  }

  // Do not inherit any sandbox credentials or mode into a production build.
  if (env.TIME2PAY_BILLING_MODE !== "live" ||
      Object.entries(env).some(([name, value]) => !!value && (name.startsWith("STRIPE_TEST_") ||
        (name.startsWith("STRIPE_") && /^(?:sk|rk|pk)_test_/.test(value)))) ||
      (requireActivation && env.TIME2PAY_LIVE_PAYMENTS_ENABLED !== "true")) {
    throw new Error("Live billing is not enabled");
  }
  const key = env.STRIPE_LIVE_RESTRICTED_KEY;
  const accountId = env.STRIPE_LIVE_ACCOUNT_ID;
  const webhookSecret = env.STRIPE_LIVE_WEBHOOK_SECRET;
  if (!key?.startsWith("rk_live_") || !/^acct_[A-Za-z0-9]+$/.test(accountId || "") ||
      accountId === SANDBOX_ACCOUNT || !webhookSecret?.startsWith("whsec_")) {
    throw new Error("Live billing configuration incomplete");
  }
  const plans = Object.fromEntries(planKeys.map(name => [name, {
    ...BILLING_PLANS[name], priceId: env[`STRIPE_LIVE_${name.toUpperCase()}_PRICE_ID`] || "",
  }])) as Record<BillingPlan, { name: string; cents: number; priceId: string }>;
  const ids = Object.values(plans).map(plan => plan.priceId);
  if (new Set(ids).size !== 3 || ids.some(id => !/^price_[A-Za-z0-9]+$/.test(id) ||
      Object.values(BILLING_PLANS).some(test => test.priceId === id))) {
    throw new Error("Live prices must be separately configured");
  }
  return { key, accountId: accountId!, livemode: true, plans, webhookSecret };
}

export function getBillingEnvironment() {
  return resolveBillingEnvironment(process.env);
}

export function assertBillingOrigin(url: URL, livemode: boolean) {
  if (livemode && (url.protocol !== "https:" || !["time2pay.nl", "www.time2pay.nl"].includes(url.hostname) ||
      url.port || url.username || url.password)) {
    throw new Error("Live billing requires the verified production origin");
  }
}
