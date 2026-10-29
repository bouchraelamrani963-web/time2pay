import type { NextRequest } from "next/server";
import { RecoveryError, deliverSecurityNotices, submitRecoverySupport, takeRecoveryRate, verifyRecoveryPassword } from "@/lib/account-recovery";
import { field, readRecoveryBody, recoveryFailure, recoveryJson } from "@/lib/recovery-http";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const body = await readRecoveryBody(req);
    const email = field(body, "email", 254).trim().toLowerCase();
    const contactEmail = field(body, "contactEmail", 254).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new RecoveryError("invalid_recovery");
    await takeRecoveryRate("email", email);
    const account = await verifyRecoveryPassword(email, field(body, "password", 4096));
    const reference = await submitRecoverySupport(account, contactEmail, field(body, "description", 1500));
    await deliverSecurityNotices(account.uid);
    return recoveryJson({ ok: true, reference, message: "Verzoek vastgelegd. Dit geeft geen toegang tot je account en is geen toezegging tot herstel." });
  } catch (error) { return recoveryFailure(error); }
}
