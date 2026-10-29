export const RECOVERY_COOKIE = "__Host-time2pay_recovery";
// Public endpoint identity checked against the existing isolated Neon project, not a copied label.
export const TEST_DATABASE_HOST = "ep-purple-mode-bau3xsnx.c-8.eu-central-1.aws.neon.tech";
function isolatedDatabase(url: string | undefined) {
  try {
    const parsed = new URL(url || "");
    return ["postgres:", "postgresql:"].includes(parsed.protocol) &&
      parsed.hostname.replace("-pooler.", ".") === TEST_DATABASE_HOST && parsed.pathname === "/neondb";
  } catch { return false; }
}
// Preview keeps its exact original branch, Firebase and database boundary.
export function previewRecoveryEnabled() {
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
// Production identifiers come from the existing application and database inventory.
// Their binding to the deployed Production secrets must be checked before opt-in.
const PRODUCTION_PROJECT = "time2pay-c5c5c";
const PRODUCTION_DATABASE_HOST = "ep-withered-flower-alwyxd3z.c-3.eu-central-1.aws.neon.tech";
function productionDatabase(value: string | undefined) {
  try {
    const url = new URL(value || "");
    return ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.hostname.replace("-pooler.", ".") === PRODUCTION_DATABASE_HOST && url.pathname === "/neondb" &&
      url.searchParams.get("sslmode") === "require";
  } catch { return false; }
}
export function productionRecoveryEnabled() {
  const secret = process.env.TIME2PAY_RECOVERY_HASH_SECRET || "";
  const cronSecret = process.env.CRON_SECRET || "";
  return process.env.VERCEL_ENV === "production" &&
    process.env.TIME2PAY_RECOVERY_ENABLED === "true" &&
    process.env.TIME2PAY_RECOVERY_DATABASE_ID === "time2pay-production" &&
    process.env.TIME2PAY_REQUIRE_TOTP === "true" && process.env.TIME2PAY_TOTP_SETUP_ENABLED === "true" &&
    process.env.FIREBASE_PROJECT_ID === PRODUCTION_PROJECT &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === PRODUCTION_PROJECT &&
    !!process.env.FIREBASE_CLIENT_EMAIL?.endsWith(`@${PRODUCTION_PROJECT}.iam.gserviceaccount.com`) &&
    !!(process.env.FIREBASE_PRIVATE_KEY_BASE64 || process.env.FIREBASE_PRIVATE_KEY) &&
    !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    !process.env.TIME2PAY_TOTP_TEST_PROJECT_ID && !process.env.FIREBASE_TEST_SERVICE_ACCOUNT_JSON &&
    !process.env.TIME2PAY_RECOVERY_PREVIEW_RETRY_PROBE &&
    productionDatabase(process.env.DATABASE_URL) && productionDatabase(process.env.DIRECT_URL) &&
    Buffer.byteLength(secret) >= 32 && Buffer.byteLength(cronSecret) >= 32 && secret !== cronSecret &&
    process.env.TIME2PAY_SECURITY_NOTICES_ENABLED === "true" &&
    process.env.TIME2PAY_EMAIL_MODE !== "test" && !process.env.RESEND_TEST_API_KEY &&
    !!process.env.RESEND_API_KEY && !!process.env.INVOICE_FROM_EMAIL;
}
export function recoveryEnabled() {
  return previewRecoveryEnabled() || productionRecoveryEnabled();
}
// Production always checks persisted recovery locks, including while rollout is
// off or misconfigured. A missing/unreadable migration fails normal auth closed.
// Preview only reads locks from the independently bound isolated environment.
export function recoveryLocksRequired() {
  return process.env.VERCEL_ENV === "production" || (
    process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "codex/time2pay-stripe-test" &&
    process.env.FIREBASE_PROJECT_ID === "time2pay-preview" &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "time2pay-preview" &&
    isolatedDatabase(process.env.DATABASE_URL) && isolatedDatabase(process.env.DIRECT_URL)
  );
}
export function recoverySecret() {
  if (!recoveryEnabled()) throw new Error("Recovery unavailable");
  return process.env.TIME2PAY_RECOVERY_HASH_SECRET!;
}
