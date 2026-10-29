import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { getStripe } from "./billing";
import { getBillingEnvironment } from "./billing-environment";
import { getAdminAuth } from "./firebase-admin";
import { getInvoiceEmailConfig } from "./email";
import { NOTICE_MAX_AGE_MS, noticeRetryAt } from "./security-notice-policy";
import type { NoticeAttempt } from "./security-notice-worker";

export async function attemptBillingNotice(id: string): Promise<NoticeAttempt> {
  if (process.env.TIME2PAY_BILLING_NOTICES_ENABLED !== "true") return { done: true };
  const now = new Date(), leaseToken = randomUUID();
  const claimed = await prisma.billingNotice.updateMany({ where: { id, sentAt: null, failedAt: null,
    suppressedAt: null, nextAttemptAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
    data: { leaseToken, leaseUntil: new Date(now.getTime() + 120000), attempts: { increment: 1 } } });
  if (claimed.count) await prisma.billingNotice.updateMany({ where: { id, leaseToken, attempts: 1, firstAttemptAt: null },
    data: { firstAttemptAt: now } });
  const notice = await prisma.billingNotice.findUnique({ where: { id } });
  if (!notice || notice.sentAt || notice.failedAt || notice.suppressedAt) return { done: true };
  if (!claimed.count) return { done: false, retryAt: new Date(Math.max(notice.nextAttemptAt.getTime(),
    notice.leaseUntil?.getTime() ?? 0, now.getTime() + 1000)).toISOString() };
  const windowStart = notice.firstAttemptAt ?? notice.createdAt;
  if (now.getTime() - windowStart.getTime() >= NOTICE_MAX_AGE_MS) {
    await prisma.billingNotice.updateMany({ where: { id, leaseToken }, data: {
      failedAt: now, lastErrorCode: "delivery_window_expired", leaseToken: null, leaseUntil: null } });
    return { done: true };
  }
  let providerId: string;
  try {
    const configuration = getBillingEnvironment();
    const account = await prisma.billingAccount.findUnique({ where: { userId: notice.userId } });
    const sub = await getStripe().subscriptions.retrieve(notice.subscriptionId, { expand: ["latest_invoice"] });
    const invoice = sub.latest_invoice;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const current = account?.customerId === notice.customerId && account.subscriptionId === sub.id &&
      customerId === notice.customerId && sub.livemode === configuration.livemode &&
      sub.items.data.length === 1 && Object.values(configuration.plans).some(p => p.priceId === sub.items.data[0]?.price.id) &&
      invoice && typeof invoice !== "string" && invoice.id === notice.invoiceId &&
      invoice.livemode === configuration.livemode &&
      (notice.kind === "PAYMENT_FAILED" ? sub.status === "past_due" && invoice.status === "open" && invoice.amount_remaining > 0 :
        notice.kind === "PAYMENT_RECEIVED" && sub.status === "active" && invoice.status === "paid" && invoice.amount_paid > 0);
    if (!current) {
      await prisma.billingNotice.updateMany({ where: { id, leaseToken }, data: {
        suppressedAt: now, leaseToken: null, leaseUntil: null, lastErrorCode: "superseded" } });
      return { done: true };
    }
    const user = await getAdminAuth().getUser(notice.userId);
    if (!user.email || !user.emailVerified || user.disabled) throw new Error("verified_recipient_unavailable");
    const failed = notice.kind === "PAYMENT_FAILED";
    const text = failed
      ? "Je abonnementsbetaling is mislukt. Open Time2Pay en kies Abonnement en betaalgegevens beheren om je betaalgegevens bij te werken. Zonder geldige gratis periode zijn verzenden, definitieve PDF en afdrukken geblokkeerd totdat je betaling is bevestigd. Een geldige gratis periode blijft behouden. Je conceptfacturen en klantgegevens blijven bewaard."
      : "Je abonnementsbetaling is ontvangen. Open Time2Pay om je actuele toegang en abonnementslimiet te bekijken. Je toegang wordt veilig gecontroleerd bij iedere factuuractie.";
    const { resend, from, testRecipient } = getInvoiceEmailConfig();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { Authorization: "Bearer " + resend.key, "Content-Type": "application/json", "Idempotency-Key": "billing-notice-" + id },
      body: JSON.stringify({ from, to: [testRecipient || user.email],
        subject: (testRecipient ? "[TEST] " : "") + (failed ? "Time2Pay: betaling mislukt" : "Time2Pay: betaling ontvangen"), text }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || typeof data?.id !== "string") throw new Error("provider_rejected");
    providerId = data.id;
  } catch {
    const retry = noticeRetryAt(notice.attempts, windowStart, new Date());
    await prisma.billingNotice.updateMany({ where: { id, leaseToken }, data: {
      leaseToken: null, leaseUntil: null, lastErrorCode: "delivery_failed",
      ...(retry ? { nextAttemptAt: retry } : { failedAt: new Date() }),
    } });
    return retry ? { done: false, retryAt: retry.toISOString() } : { done: true };
  }
  await prisma.billingNotice.updateMany({ where: { id, leaseToken }, data: {
    sentAt: new Date(), providerId, leaseToken: null, leaseUntil: null, lastErrorCode: null } });
  return { done: true };
}
