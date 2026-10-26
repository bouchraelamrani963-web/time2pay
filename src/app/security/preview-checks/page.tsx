import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { previewRecoveryEnabled } from "@/lib/recovery-config";
import PreviewNoticeCheck from "./test-panel";
export default async function PreviewChecks() {
  if (!previewRecoveryEnabled() || process.env.TIME2PAY_SECURITY_NOTICES_ENABLED !== "true") notFound();
  await requireUser();
  return <PreviewNoticeCheck />;
}
