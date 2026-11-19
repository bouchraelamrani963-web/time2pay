import "server-only";
import { cache } from "react";
import { isSupportAgent } from "@/lib/helpdesk/service";

// The active support role is necessary, but only the configured owner may see
// platform-wide data. An absent owner configuration denies access.
export const canUsePlatformAdmin = cache(async (uid: string) => {
  if (!uid || uid !== process.env.TIME2PAY_PLATFORM_ADMIN_UID) return false;
  try {
    return await isSupportAgent(uid);
  } catch {
    return false;
  }
});
