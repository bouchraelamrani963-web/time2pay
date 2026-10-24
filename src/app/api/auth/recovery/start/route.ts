import type { NextRequest } from "next/server";
import { beginRecovery, takeRecoveryRate, verifyRecoveryPassword } from "@/lib/account-recovery";
import { field, readRecoveryBody, recoveryFailure, recoveryJson } from "@/lib/recovery-http";
import { RECOVERY_COOKIE } from "@/lib/recovery-config";
import { SESSION_COOKIE } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const body = await readRecoveryBody(req);
    const email = field(body, "email", 254).trim().toLowerCase();
    await takeRecoveryRate("email", email);
    const account = await verifyRecoveryPassword(email, field(body, "password", 4096));
    await takeRecoveryRate("account", account.uid);
    const grant = await beginRecovery(account, field(body, "recoveryCode", 64));
    const response = recoveryJson({ ok: true, next: "/login?security=setup" });
    response.cookies.set(RECOVERY_COOKIE, grant, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 900 });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) { return recoveryFailure(error); }
}
