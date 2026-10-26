import "server-only";
import type { DecodedIdToken, UserRecord } from "firebase-admin/auth";
import type { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { getAdminAuth } from "./firebase-admin";
import { recoveryEnabled, recoverySecret, recoveryLocksRequired } from "./recovery-config";
import { createRecoveryCodes, equalDigest, normalizeRecoveryCode, recoveryDigest } from "./recovery-crypto";
import { mayCompleteRecovery, signedTotpFactor } from "./recovery-policy";

export class RecoveryError extends Error {
  constructor(public code: string, public status = 403) { super(code); }
}
export function assertRecoveryEnabled() {
  if (!recoveryEnabled()) throw new RecoveryError("recovery_unavailable", 503);
}
export async function recoveryLocked(userId: string) {
  if (!recoveryLocksRequired()) return false;
  const state = await prisma.accountRecovery.findUnique({ where: { userId } });
  return !!state && state.status !== "NONE";
}
export async function takeRecoveryRate(scope: string, subject: string, limit = 5, seconds = 900) {
  const key = recoveryDigest(recoverySecret(), "rate:" + scope, subject);
  const allowed = await prisma.$transaction(async tx => {
    // Parameter-bound SQL, not string interpolation. Persist across workers/restarts.
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", key);
    const now = new Date();
    const old = await tx.securityRateBucket.findUnique({ where: { key } });
    if (old?.blockedUntil && old.blockedUntil > now) return false;
    const fresh = !old || now.getTime() - old.windowStart.getTime() >= seconds * 1000;
    const attempts = fresh ? 1 : old.attempts + 1;
    await tx.securityRateBucket.upsert({ where: { key }, create: { key, attempts, windowStart: now },
      update: { attempts, windowStart: fresh ? now : old!.windowStart,
        blockedUntil: attempts > limit ? new Date(now.getTime() + seconds * 1000) : null } });
    return attempts <= limit;
  });
  if (!allowed) throw new RecoveryError("try_later", 429);
}
// Only the existing Firebase project verifies passwords. No second password store.
export async function verifyRecoveryPassword(email: string, password: string) {
  assertRecoveryEnabled();
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new RecoveryError("recovery_unavailable", 503);
  const result = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + encodeURIComponent(apiKey), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true, clientType: "CLIENT_TYPE_WEB" }),
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  const data = await result.json().catch(() => null);
  if (!result.ok || !data || (data.email && data.email.toLowerCase() !== email.toLowerCase())) throw new RecoveryError("invalid_recovery");
  // Firebase's MFA challenge response may omit localId/email. This response was obtained
  // directly from Firebase after password verification, never accepted from the browser.
  const account = typeof data.localId === "string"
    ? await getAdminAuth().getUser(data.localId)
    : await getAdminAuth().getUserByEmail(email);
  if (account.disabled || !account.emailVerified || account.email?.toLowerCase() !== email.toLowerCase() ||
      !account.providerData.some(p => p.providerId === "password")) throw new RecoveryError("invalid_recovery");
  const state = await prisma.accountRecovery.findUnique({ where: { userId: account.uid } });
  const hasPendingMfa = typeof data.mfaPendingCredential === "string" && data.mfaPendingCredential.length > 0 &&
    Array.isArray(data.mfaInfo) && data.mfaInfo.some((item: { mfaEnrollmentId?: string }) =>
      account.multiFactor?.enrolledFactors.some(f => f.factorId === "totp" && f.uid === item.mfaEnrollmentId));
  if (!hasPendingMfa) {
    // Password-only proof is allowed only for support intake on an already locked recovery.
    if (state?.status === "NONE" || !state || typeof data.idToken !== "string") throw new RecoveryError("invalid_recovery");
    const token = await getAdminAuth().verifyIdToken(data.idToken, true);
    if (token.uid !== account.uid || token.firebase?.sign_in_provider !== "password" ||
        Date.now() / 1000 - token.auth_time > 60) throw new RecoveryError("invalid_recovery");
  }
  return account;
}
async function audit(tx: Prisma.TransactionClient, userId: string, kind: string, email?: string) {
  await tx.securityEvent.create({ data: { userId, kind } });
  if (email) await tx.securityNotice.create({ data: { userId, kind, email } });
}
async function replaceCodes(tx: Prisma.TransactionClient, userId: string) {
  const codes = createRecoveryCodes();
  await tx.recoveryCode.deleteMany({ where: { userId } });
  await tx.recoveryCode.createMany({ data: codes.map(code => ({
    userId, codeHash: recoveryDigest(recoverySecret(), "code:" + userId, normalizeRecoveryCode(code)!),
  })) });
  await tx.accountRecovery.upsert({ where: { userId }, create: { userId, codesIssuedAt: new Date() },
    update: { codesIssuedAt: new Date() } });
  return codes;
}
export async function beginRecovery(account: UserRecord, inputCode: string) {
  const normalized = normalizeRecoveryCode(inputCode);
  if (!normalized) throw new RecoveryError("invalid_recovery");
  const grant = randomBytes(32).toString("hex");
  const grantHash = recoveryDigest(recoverySecret(), "grant", grant);
  const hash = recoveryDigest(recoverySecret(), "code:" + account.uid, normalized);
  const accepted = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", account.uid);
    const state = await tx.accountRecovery.findUnique({ where: { userId: account.uid } });
    if (!state || !["NONE", "RESETTING", "ENROLLMENT_REQUIRED"].includes(state.status)) return false;
    const used = await tx.recoveryCode.updateMany({ where: { userId: account.uid, codeHash: hash, usedAt: null },
      data: { usedAt: new Date() } });
    if (used.count !== 1) {
      await audit(tx, account.uid, "RECOVERY_DENIED");
      return false;
    }
    const latest = await getAdminAuth().getUser(account.uid);
    if (latest.disabled || !latest.emailVerified) throw new RecoveryError("invalid_recovery");
    const startedAt = new Date();
    await tx.accountRecovery.update({ where: { userId: account.uid }, data: {
      status: "RESETTING", grantHash, startedAt, expiresAt: new Date(startedAt.getTime() + 15 * 60 * 1000),
      oldFactors: Array.from(new Set([...(state.oldFactors ?? []), ...(latest.multiFactor?.enrolledFactors.map(f => f.uid) ?? [])])),
    } });
    await audit(tx, account.uid, "RECOVERY_STARTED", account.email!);
    return true;
  });
  if (!accepted) throw new RecoveryError("invalid_recovery");
  // Commit the application lock BEFORE changing Firebase; failures never unlock access.
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", account.uid);
    const state = await tx.accountRecovery.findUnique({ where: { userId: account.uid } });
    if (state?.status !== "RESETTING" || state.grantHash !== grantHash) throw new RecoveryError("invalid_recovery");
    const auth = getAdminAuth();
    const latest = await auth.getUser(account.uid);
    if (latest.disabled || !latest.emailVerified) throw new RecoveryError("invalid_recovery");
    await auth.setCustomUserClaims(account.uid, { ...latest.customClaims, time2payRecoveryLocked: true });
    await auth.revokeRefreshTokens(account.uid);
    await auth.updateUser(account.uid, { multiFactor: { enrolledFactors: [] } });
    await tx.accountRecovery.update({ where: { userId: account.uid }, data: { status: "ENROLLMENT_REQUIRED" } });
  }, { timeout: 20000 });
  await deliverSecurityNotices(account.uid);
  return grant;
}
export async function exchangeRecoverySession(token: DecodedIdToken, account: UserRecord, grant?: string): Promise<{ recoveryCodes?: string[]; recovered?: boolean }> {
  if (!recoveryEnabled()) {
    if (account.customClaims?.time2payRecoveryLocked || await recoveryLocked(account.uid)) throw new RecoveryError("recovery_unavailable", 503);
    return {};
  }
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", account.uid);
    const state = await tx.accountRecovery.findUnique({ where: { userId: account.uid } });
    if (state && state.status !== "NONE") {
      if (!account.multiFactor?.enrolledFactors.some(f => f.factorId === "totp")) throw new RecoveryError("mfa_setup_required");
      if (token.firebase?.sign_in_second_factor !== "totp") throw new RecoveryError("mfa_required");
      if (!state.expiresAt || state.expiresAt.getTime() <= Date.now()) throw new RecoveryError("recovery_expired");
      if (!grant) throw new RecoveryError("recovery_session_missing");
      if (!equalDigest(state.grantHash, recoveryDigest(recoverySecret(), "grant", grant)) ||
          !mayCompleteRecovery(token, account, state)) throw new RecoveryError("invalid_recovery");
      const recoveryCodes = await replaceCodes(tx, account.uid);
      await audit(tx, account.uid, "RECOVERY_COMPLETED", account.email!);
      const latest = await getAdminAuth().getUser(account.uid);
      const claims = { ...latest.customClaims };
      delete claims.time2payRecoveryLocked;
      await getAdminAuth().setCustomUserClaims(account.uid, claims);
      await tx.accountRecovery.update({ where: { userId: account.uid },
        data: { status: "NONE", grantHash: null, expiresAt: null, oldFactors: [] } });
      return { recoveryCodes, recovered: true };
    }
    if (account.customClaims?.time2payRecoveryLocked) throw new RecoveryError("invalid_recovery");
    // Initial issuance requires an actual fresh password + TOTP sign-in after enrollment.
    if (!state?.codesIssuedAt && signedTotpFactor(token, account)) {
      const recoveryCodes = await replaceCodes(tx, account.uid);
      await audit(tx, account.uid, "RECOVERY_CODES_CREATED", account.email!);
      return { recoveryCodes };
    }
    return {};
  }, { timeout: 20000 });
}
export async function regenerateRecoveryCodes(token: DecodedIdToken, account: UserRecord) {
  if (!signedTotpFactor(token, account) || account.customClaims?.time2payRecoveryLocked) throw new RecoveryError("recent_totp_required");
  await takeRecoveryRate("regenerate", account.uid, 3, 3600);
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", account.uid);
    const state = await tx.accountRecovery.findUnique({ where: { userId: account.uid } });
    if (state && state.status !== "NONE") throw new RecoveryError("invalid_recovery");
    const codes = await replaceCodes(tx, account.uid);
    await audit(tx, account.uid, "RECOVERY_CODES_REPLACED", account.email!);
    return codes;
  });
}
export async function submitRecoverySupport(account: UserRecord, contactEmail: string, description: string) {
  await takeRecoveryRate("support", account.uid, 2, 86400);
  return prisma.$transaction(async tx => {
    const request = await tx.recoverySupportRequest.create({ data: { userId: account.uid, contactEmail, description } });
    await audit(tx, account.uid, "RECOVERY_SUPPORT_REQUESTED", account.email!);
    // Intake is never permission to reset, even after a waiting period.
    return request.id;
  });
}
export async function deliverSecurityNotices(userId: string) {
  if (!recoveryEnabled() || process.env.TIME2PAY_SECURITY_NOTICES_ENABLED !== "true") return;
  try {
    const { dispatchSecurityNotices } = await import("./security-notice-dispatch");
    await dispatchSecurityNotices(userId);
  } catch {
    // The transaction already persisted the outbox. The authenticated sweeper retries dispatch.
    console.error("security_notice_dispatch_pending");
  }
}
