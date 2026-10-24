import { sleep } from "workflow";
import type { NoticeAttempt } from "../lib/security-notice-worker";

export async function securityNoticeWorkflow(noticeId: string) {
  "use workflow";
  // Only the opaque outbox ID enters Workflow's durable event log.
  for (;;) {
    const result = await deliver(noticeId);
    if (result.done) return;
    await sleep(new Date(result.retryAt));
  }
}
async function deliver(noticeId: string): Promise<NoticeAttempt> {
  "use step";
  const { attemptSecurityNotice } = await import("../lib/security-notice-worker");
  return attemptSecurityNotice(noticeId);
}
