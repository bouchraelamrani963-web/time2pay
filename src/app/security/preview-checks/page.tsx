import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { recoveryEnabled } from "@/lib/recovery-config";
import PreviewNoticeCheck from "./test-panel";
export default async function PreviewChecks() {
  if (!recoveryEnabled() || process.env.TIME2PAY_SECURITY_NOTICES_ENABLED !== "true") notFound();
  await requireUser();
  return <PreviewNoticeCheck />;
}
