import "server-only";
import { start, getRun } from "workflow/api";
import { prisma } from "./prisma";
import { recoveryEnabled } from "./recovery-config";
import { securityNoticeWorkflow } from "../workflows/security-notice";

export async function dispatchSecurityNotices(userId?: string) {
  if (!recoveryEnabled() || process.env.TIME2PAY_SECURITY_NOTICES_ENABLED !== "true") return 0;
  const now = new Date();
  if (!userId) {
    const interrupted = await prisma.securityNotice.findMany({ where: { sentAt: null, failedAt: null,
      workflowRunId: { not: null }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }, take: 50 });
    for (const notice of interrupted) {
      try {
        const status = await getRun(notice.workflowRunId!).status;
        if (["failed", "cancelled", "completed"].includes(status)) {
          await prisma.securityNotice.updateMany({ where: { id: notice.id, workflowRunId: notice.workflowRunId,
            sentAt: null, failedAt: null }, data: { workflowRunId: null, dispatchLeaseUntil: null } });
        }
      } catch { console.error("security_notice_status_pending", notice.id); }
    }
  }
  const notices = await prisma.securityNotice.findMany({ where: { ...(userId ? { userId } : {}),
    sentAt: null, failedAt: null, workflowRunId: null,
    OR: [{ dispatchLeaseUntil: null }, { dispatchLeaseUntil: { lte: now } }] },
    orderBy: { createdAt: "asc" }, take: 50 });
  let count = 0;
  for (const notice of notices) {
    const lease = new Date(now.getTime() + 120000);
    const claimed = await prisma.securityNotice.updateMany({ where: { id: notice.id, workflowRunId: null,
      OR: [{ dispatchLeaseUntil: null }, { dispatchLeaseUntil: { lte: now } }] }, data: { dispatchLeaseUntil: lease } });
    if (!claimed.count) continue;
    try {
      const run = await start(securityNoticeWorkflow, [notice.id]);
      await prisma.securityNotice.updateMany({ where: { id: notice.id, dispatchLeaseUntil: lease },
        data: { workflowRunId: run.runId, dispatchLeaseUntil: null } });
      count++;
    } catch {
      console.error("security_notice_dispatch_pending", notice.id);
      // Lease expiry lets the sweeper recover a crash before dispatch. Duplicate runs share a send lease/idempotency key.
    }
  }
  return count;
}
