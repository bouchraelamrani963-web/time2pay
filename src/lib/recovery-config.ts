export const RECOVERY_COOKIE = "__Host-time2pay_recovery";
// Public endpoint identity checked against the existing isolated Neon project, not a copied label.
const TEST_DATABASE_HOST = "ep-purple-mode-bau3xsnx.c-8.eu-central-1.aws.neon.tech";
function isolatedDatabase(url: string | undefined) {
  try {
    const parsed = new URL(url || "");
    return ["postgres:", "postgresql:"].includes(parsed.protocol) &&
      parsed.hostname.replace("-pooler.", ".") === TEST_DATABASE_HOST && parsed.pathname === "/neondb";
  } catch { return false; }
}
// This draft cannot enable recovery in Production, even by copying Preview flags.
export function recoveryEnabled() {
  return process.env.TIME2PAY_RECOVERY_ENABLED === "true" &&
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "codex/time2pay-stripe-test" &&
    isolatedDatabase(process.env.DATABASE_URL) && isolatedDatabase(process.env.DIRECT_URL) &&
    process.env.TIME2PAY_RECOVERY_DATABASE_ID === "time2pay-stripe-test" &&
    process.env.TIME2PAY_REQUIRE_TOTP === "true" &&
    process.env.TIME2PAY_TOTP_SETUP_ENABLED === "true" &&
    process.env.TIME2PAY_TOTP_TEST_PROJECT_ID === "time2pay-preview" &&
    process.env.FIREBASE_PROJECT_ID === "time2pay-preview" &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "time2pay-preview" &&
    Buffer.byteLength(process.env.TIME2PAY_RECOVERY_HASH_SECRET ?? "") >= 32;
}
export function recoverySecret() {
  if (!recoveryEnabled()) throw new Error("Recovery unavailable");
  return process.env.TIME2PAY_RECOVERY_HASH_SECRET!;
}
