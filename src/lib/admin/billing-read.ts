import "server-only";
import Stripe from "stripe";
import { resolveBillingEnvironment } from "@/lib/billing-environment";
import { grantsPaidAccess, type BillingPlan } from "@/lib/billing-plans";

export type BillingLink = {
  userId: string;
  customerId: string | null;
  subscriptionId: string | null;
};

export type SubscriptionSummary = {
  plan: BillingPlan;
  status: Stripe.Subscription.Status;
  renewsAt: string | null;
  endsAt: string | null;
  stripeTrialEndsAt: string | null;
  invoiceStatus: Stripe.Invoice.Status | null;
  overdueCents: number | null;
};
export type LinkedSubscription = { summary: SubscriptionSummary; paidAccess: boolean };

const MAX_STRIPE_RECORDS = 2000;
const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : value?.id;
const iso = (seconds: number | null) => seconds ? new Date(seconds * 1000).toISOString() : null;
const monthFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
});
export const monthKey = (time: number | Date) => monthFormatter.format(time);

export async function openBillingReader() {
  const configuration = resolveBillingEnvironment(process.env, false);
  const stripe = new Stripe(configuration.key, { timeout: 5000, maxNetworkRetries: 0 });
  if ((await stripe.accounts.retrieveCurrent()).id !== configuration.accountId) {
    throw new Error("Unexpected billing account");
  }
  const plans = new Map(Object.entries(configuration.plans).map(
    ([plan, value]) => [value.priceId, plan as BillingPlan],
  ));
  const paidAccessEnabled = !configuration.livemode || process.env.TIME2PAY_LIVE_PAYMENTS_ENABLED === "true";
  return { stripe, plans, livemode: configuration.livemode, paidAccessEnabled };
}

type BillingReader = Awaited<ReturnType<typeof openBillingReader>>;

function arrears(invoice: Stripe.Invoice | null, status: Stripe.Subscription.Status, now: number) {
  if (invoice?.currency !== "eur") return null;
  const collectionFailed = status === "past_due" || status === "unpaid";
  const pastDueDate = invoice.due_date !== null && invoice.due_date * 1000 < now;
  if (invoice.status === "uncollectible" || (invoice.status === "open" && (collectionFailed || pastDueDate))) {
    return invoice.amount_remaining;
  }
  return collectionFailed && invoice.status !== "paid" ? null : 0;
}

export async function readSubscriptions(reader: BillingReader, links: BillingLink[], now: number) {
  const { stripe, plans, livemode, paidAccessEnabled } = reader;
  const linked = new Map(links.flatMap(link => link.subscriptionId ? [[link.subscriptionId, link] as const] : []));
  const summaries = new Map<string, LinkedSubscription>();
  if (!linked.size) return summaries;

  let scanned = 0;
  for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.latest_invoice"] })) {
    if (++scanned > MAX_STRIPE_RECORDS) throw new Error("Subscription scan incomplete");
    const link = linked.get(sub.id);
    if (!link) continue;
    const item = sub.items.data[0];
    const plan = item && plans.get(item.price.id);
    if (!link.customerId || idOf(sub.customer) !== link.customerId || sub.livemode !== livemode ||
      sub.items.data.length !== 1 || sub.items.has_more || !plan) continue;

    const invoice = typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
    const confirmed = invoice?.livemode === livemode && idOf(invoice.customer) === link.customerId &&
      idOf(invoice.parent?.subscription_details?.subscription) === sub.id ? invoice : null;
    const ended = sub.ended_at ?? sub.cancel_at ?? (sub.cancel_at_period_end ? item.current_period_end : null);

    summaries.set(link.userId, {
      summary: {
        plan, status: sub.status,
        renewsAt: (sub.status === "active" || sub.status === "trialing") && !ended ? iso(item.current_period_end) : null,
        endsAt: iso(ended ?? (sub.status === "canceled" || sub.status === "incomplete_expired" ? item.current_period_end : null)),
        stripeTrialEndsAt: sub.status === "trialing" ? iso(sub.trial_end) : null,
        invoiceStatus: confirmed?.status ?? null,
        overdueCents: arrears(confirmed, sub.status, now),
      },
      paidAccess: paidAccessEnabled && grantsPaidAccess({
        livemode: sub.livemode, status: sub.status,
        invoicePaid: confirmed?.status === "paid" && confirmed.amount_paid > 0,
        priceId: item.price.id, periodEnd: item.current_period_end,
      }, now, { livemode, priceIds: [...plans.keys()] }),
    });

    if (summaries.size === linked.size) break;
  }
  return summaries;
}

export async function readReceivedPayments(reader: BillingReader, links: BillingLink[], month: string) {
  const { stripe, plans, livemode } = reader;
  if (!livemode) return null;
  const customers = new Set(links.flatMap(link => link.customerId ? [link.customerId] : []));
  if (!customers.size) return 0;

  let cents = 0;
  let scanned = 0;
  const counted = new Set<string>();
  // Use successful payment timestamps, including payments made in a later
  // month than the invoice was created. Report gross receipts, in EUR only.
  for await (const payment of stripe.invoicePayments.list({ status: "paid", limit: 100, expand: ["data.invoice"] })) {
    if (++scanned > MAX_STRIPE_RECORDS) throw new Error("Payment scan incomplete");
    const paidAt = payment.status_transitions.paid_at;
    if (!payment.livemode || payment.status !== "paid" || !paidAt || monthKey(paidAt * 1000) !== month ||
      !payment.amount_paid || counted.has(payment.id)) continue;
    if (!(payment.payment.type === "charge" && idOf(payment.payment.charge)) &&
      !(payment.payment.type === "payment_intent" && idOf(payment.payment.payment_intent))) continue;

    const invoice = payment.invoice;
    if (typeof invoice === "string" || invoice.deleted) throw new Error("Invoice unavailable");
    const customer = idOf(invoice.customer);
    if (!invoice.livemode || !customer || !customers.has(customer) ||
      invoice.parent?.type !== "subscription_details") continue;
    if (invoice.lines.has_more) throw new Error("Invoice lines incomplete");
    const prices = invoice.lines.data.map(line => idOf(line.pricing?.price_details?.price));
    if (!prices.some(price => price && plans.has(price))) continue;
    if (prices.some(price => !price || !plans.has(price)) || payment.currency !== "eur" || invoice.currency !== "eur") {
      throw new Error("Payment cannot be attributed entirely to a Time2Pay plan in EUR");
    }
    cents += payment.amount_paid;
    counted.add(payment.id);
  }
  return cents;
}
