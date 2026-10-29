import type { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { deliverSecurityNotices, regenerateRecoveryCodes } from "@/lib/account-recovery";
import { field, readRecoveryBody, recoveryFailure, recoveryJson } from "@/lib/recovery-http";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const body = await readRecoveryBody(req);
    const token = await getAdminAuth().verifyIdToken(field(body, "idToken", 16000), true);
    const account = await getAdminAuth().getUser(token.uid);
    const recoveryCodes = await regenerateRecoveryCodes(token, account);
    await deliverSecurityNotices(token.uid);
    return recoveryJson({ recoveryCodes });
  } catch (error) { return recoveryFailure(error); }
}
