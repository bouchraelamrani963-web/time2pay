import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { getInvoiceEmailConfig } from "./email";
import { recoveryEnabled } from "./recovery-config";
import { NOTICE_MAX_AGE_MS, noticeRetryAt } from "./security-notice-policy";

export type NoticeAttempt = { done: true } | { done: false; retryAt: string };
export async function attemptSecurityNotice(id: string): Promise<NoticeAttempt> {
  if (!recoveryEnabled() || process.env.TIME2PAY_SECURITY_NOTICES_ENABLED !== "true") return { done: true };
  const now = new Date(), leaseToken = randomUUID();
  const claimed = await prisma.securityNotice.updateMany({ where: { id, sentAt: null, failedAt: null,
    nextAttemptAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
    data: { leaseToken, leaseUntil: new Date(now.getTime() + 120000), attempts: { increment: 1 } } });
  const notice = await prisma.securityNotice.findUnique({ where: { id } });
  if (!notice || notice.sentAt || notice.failedAt) return { done: true };
  if (!claimed.count) return { done: false, retryAt: new Date(Math.max(notice.nextAttemptAt.getTime(), notice.leaseUntil?.getTime() ?? 0, now.getTime() + 1000)).toISOString() };
  if (now.getTime() - notice.createdAt.getTime() >= NOTICE_MAX_AGE_MS) {
    await prisma.securityNotice.updateMany({ where: { id, leaseToken }, data: {
      failedAt: now, lastErrorCode: "delivery_window_expired", leaseToken: null, leaseUntil: null } });
    console.error("security_notice_manual_review", id);
    return { done: true };
  }
  let providerId: string | undefined;
  try {
    // Fault injection is restricted to an explicit synthetic notice in the isolated Preview.
    // Ordinary security notices always use the normal transport on their first attempt.
    if (notice.kind === "PREVIEW_RETRY_CHECK" && notice.attempts === 1) throw new Error("preview_retry_probe");
    const { resend, from, testRecipient } = getInvoiceEmailConfig();
    // Abort the actual HTTP request; no password, factor secret or recovery code is sent.
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { Authorization: "Bearer " + resend.key, "Content-Type": "application/json", "Idempotency-Key": "security-notice-" + id },
      body: JSON.stringify({ from, to: [testRecipient || notice.email],
        subject: (testRecipient ? "[TEST] " : "") + "Time2Pay beveiligingsmelding",
        text: "Op " + notice.createdAt.toISOString() + " is een beveiligingsactie uitgevoerd: " + notice.kind +
          ". Was jij dit niet? Neem direct contact op met support. Deel nooit je wachtwoord, authenticator- of herstelcodes." }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || typeof data?.id !== "string") throw new Error("provider_rejected");
    providerId = data.id;
  } catch {
    const retry = noticeRetryAt(notice.attempts, notice.createdAt, new Date());
    await prisma.securityNotice.updateMany({ where: { id, leaseToken }, data: {
      leaseToken: null, leaseUntil: null, lastErrorCode: "delivery_failed",
      ...(retry ? { nextAttemptAt: retry } : { failedAt: new Date() }),
    } });
    if (!retry) console.error("security_notice_manual_review", id);
    return retry ? { done: false, retryAt: retry.toISOString() } : { done: true };
  }
  // Provider acceptance is not proof of inbox delivery. Database failure triggers a safe replay.
  await prisma.securityNotice.updateMany({ where: { id, leaseToken }, data: {
    sentAt: new Date(), providerId, lastErrorCode: null, leaseToken: null, leaseUntil: null } });
  return { done: true };
}
