import "server-only";
import type Stripe from "stripe";
import type { PrismaClient } from "@prisma/client";

export const BILLING_EVENTS = new Set([
  "checkout.session.completed", "checkout.session.async_payment_succeeded",
  "invoice.payment_failed", "invoice.paid",
  "customer.subscription.updated", "customer.subscription.deleted",
]);

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : value?.id;

// The event is already signature/account/mode checked by the HTTP boundary.
// Events are hints, never an entitlement cache: protected actions still fetch Stripe.
export async function processBillingEvent(event: Stripe.Event, stripe: Stripe,
  db: PrismaClient, configuration: { accountId: string; livemode: boolean; plans: Record<string, { priceId: string }> }) {
  if (!BILLING_EVENTS.has(event.type)) return;
  if (event.livemode !== configuration.livemode) throw new Error("Wrong billing environment");
  let customerId: string | undefined, subscriptionId: string | undefined;
  let session: Stripe.Checkout.Session | undefined;
  if (event.type.startsWith("checkout.session.")) {
    session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription" || session.payment_status !== "paid") return;
    customerId = idOf(session.customer); subscriptionId = idOf(session.subscription);
  } else if (event.type.startsWith("invoice.")) {
    const invoice = event.data.object as Stripe.Invoice;
    customerId = idOf(invoice.customer);
    subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
  } else {
    const sub = event.data.object as Stripe.Subscription;
    customerId = idOf(sub.customer); subscriptionId = sub.id;
  }
  if (!customerId || !subscriptionId) return; // Non-subscription invoices are outside this flow.
  const receiptKey = { accountId_eventId: { accountId: configuration.accountId, eventId: event.id } };
  await db.$transaction(async tx => {
    // Serialize customer events, including distinct simultaneous IDs. Do not use event.created
    // as an ordering cursor: multiple Stripe events can share the same second.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"billing:" + configuration.accountId + ":" + customerId}))`;
    if (await tx.billingWebhookEvent.findUnique({ where: receiptKey })) return;
    const account = await tx.billingAccount.findUnique({ where: { customerId } });
    // Never create or guess an application account from Stripe metadata.
    if (!account) return;
    const sub = await stripe.subscriptions.retrieve(subscriptionId!, { expand: ["latest_invoice"] });
    if (sub.livemode !== configuration.livemode || idOf(sub.customer) !== customerId ||
      sub.items.data.length !== 1 || !Object.values(configuration.plans).some(p => p.priceId === sub.items.data[0]?.price.id)) {
      throw new Error("Subscription ownership or price mismatch");
    }
    if (session) {
      const userId = session.metadata?.time2payUserId;
      if (userId !== account.userId || session.client_reference_id !== userId || sub.metadata.time2payUserId !== userId) {
        throw new Error("Checkout ownership mismatch");
      }
      if (account.subscriptionId && account.subscriptionId !== sub.id) {
        // Re-subscription after cancellation is valid, but an old Checkout retry
        // must never replace another still-current subscription.
        const previous = await stripe.subscriptions.retrieve(account.subscriptionId);
        if (!["canceled", "incomplete_expired"].includes(previous.status) ||
          idOf(previous.customer) !== customerId || previous.livemode !== configuration.livemode) return;
      }
      await tx.billingAccount.update({ where: { userId: account.userId }, data: { subscriptionId: sub.id } });
    } else if (!account.subscriptionId) {
      // A lifecycle event may arrive before Checkout. Keep retryable until the trusted mapping exists.
      throw new Error("Checkout mapping pending");
    } else if (account.subscriptionId !== sub.id) {
      return; // A previous subscription cannot affect the customer's current subscription.
    }
    const invoice = sub.latest_invoice;
    if (invoice && typeof invoice !== "string" && invoice.livemode === configuration.livemode &&
      idOf(invoice.customer) === customerId) {
      const isCurrentInvoiceEvent = !event.type.startsWith("invoice.") || (event.data.object as Stripe.Invoice).id === invoice.id;
      const kind = sub.status === "past_due" && invoice.status === "open" && invoice.amount_remaining > 0
        ? "PAYMENT_FAILED" : sub.status === "active" && invoice.status === "paid" && invoice.amount_paid > 0
          ? "PAYMENT_RECEIVED" : null;
      if (kind && isCurrentInvoiceEvent) {
        // Coalesce invoice + subscription events and separate event IDs for the same outcome.
        const key = configuration.accountId + ":" + sub.id + ":" + invoice.id + ":" + kind;
        await tx.billingNotice.upsert({ where: { key }, update: {}, create: {
          key, userId: account.userId, customerId, subscriptionId: sub.id, invoiceId: invoice.id, kind,
        } });
      }
    }
    // Commit the receipt and durable notification together; a failed transaction can be retried.
    await tx.billingWebhookEvent.create({ data: { accountId: configuration.accountId,
      eventId: event.id, eventType: event.type } });
  }, { timeout: 20000 });
}
