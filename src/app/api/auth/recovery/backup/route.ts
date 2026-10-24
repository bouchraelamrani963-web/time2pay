import type { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";
import { RecoveryError, deliverSecurityNotices, recoveryLocked, takeRecoveryRate } from "@/lib/account-recovery";
import { signedTotpFactor } from "@/lib/recovery-policy";
import { field, readRecoveryBody, recoveryFailure, recoveryJson } from "@/lib/recovery-http";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const body = await readRecoveryBody(req);
    const auth = getAdminAuth();
    const token = await auth.verifyIdToken(field(body, "idToken", 16000), true);
    const account = await auth.getUser(token.uid);
    if (!signedTotpFactor(token, account) || account.customClaims?.time2payRecoveryLocked || await recoveryLocked(token.uid)) throw new RecoveryError("recent_totp_required");
    await takeRecoveryRate("backup", token.uid, 5, 3600);
    const factors = account.multiFactor?.enrolledFactors ?? [];
    if (body.action === "prepare") {
      if (factors.length >= 2) throw new RecoveryError("backup_already_present");
      return recoveryJson({ ok: true });
    }
    if (body.action !== "complete" || factors.length !== 2 || factors.some(f => f.factorId !== "totp")) throw new RecoveryError("invalid_recovery");
    await prisma.$transaction([
      prisma.securityEvent.create({ data: { userId: token.uid, kind: "BACKUP_AUTHENTICATOR_ADDED" } }),
      prisma.securityNotice.create({ data: { userId: token.uid, email: account.email!, kind: "BACKUP_AUTHENTICATOR_ADDED" } }),
    ]);
    await auth.revokeRefreshTokens(token.uid);
    await deliverSecurityNotices(token.uid);
    return recoveryJson({ ok: true });
  } catch (error) { return recoveryFailure(error); }
}
