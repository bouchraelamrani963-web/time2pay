import { NextRequest } from "next/server";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { previewRecoveryEnabled } from "@/lib/recovery-config";
import { readRecoveryBody, recoveryFailure, recoveryJson } from "@/lib/recovery-http";
import { takeRecoveryRate, deliverSecurityNotices } from "@/lib/account-recovery";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
function enabled() { return previewRecoveryEnabled() && process.env.TIME2PAY_SECURITY_NOTICES_ENABLED === "true"; }
export async function POST(req: NextRequest) {
  if (!enabled()) return recoveryJson({ error: "unavailable" }, 404);
  try {
    await readRecoveryBody(req);
    const user = await requireUserOrUnauthorized();
    if (user instanceof Response) return user;
    await takeRecoveryRate("notice-check", user.uid, 3, 3600);
    const notice = await prisma.securityNotice.create({ data: {
      userId: user.uid, email: "delivered@resend.dev", kind: "PREVIEW_RETRY_CHECK",
      // Reproduce a notice discovered by the fallback sweep after a long queue
      // delay. This synthetic timestamp is restricted to the isolated probe.
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    } });
    await deliverSecurityNotices(user.uid);
    return recoveryJson({ id: notice.id });
  } catch (error) { return recoveryFailure(error); }
}
export async function GET(req: NextRequest) {
  if (!enabled()) return recoveryJson({ error: "unavailable" }, 404);
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;
  const id = req.nextUrl.searchParams.get("id");
  if (!id || id.length > 100) return recoveryJson({ error: "not_found" }, 404);
  const notice = await prisma.securityNotice.findFirst({ where: { id, userId: user.uid, kind: "PREVIEW_RETRY_CHECK" },
    select: { attempts: true, sentAt: true, failedAt: true, lastErrorCode: true, nextAttemptAt: true } });
  return notice ? recoveryJson({ attempts: notice.attempts, accepted: !!notice.sentAt, failed: !!notice.failedAt,
    retryScheduled: notice.lastErrorCode === "delivery_failed" && !notice.failedAt && !notice.sentAt,
    nextAttemptAt: notice.nextAttemptAt.toISOString() }) : recoveryJson({ error: "not_found" }, 404);
}
