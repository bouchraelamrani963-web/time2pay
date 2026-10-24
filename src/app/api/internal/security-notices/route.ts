import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { recoveryEnabled } from "@/lib/recovery-config";
import { dispatchSecurityNotices } from "@/lib/security-notice-dispatch";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from("Bearer " + (secret || ""));
  if (!secret || secret.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!recoveryEnabled() || process.env.TIME2PAY_SECURITY_NOTICES_ENABLED !== "true") {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  return NextResponse.json({ dispatched: await dispatchSecurityNotices() });
}
