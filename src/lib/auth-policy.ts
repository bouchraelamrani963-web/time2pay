import type { DecodedIdToken, UserRecord } from "firebase-admin/auth";

export function getMfaConfiguration() {
  const required = process.env.TIME2PAY_REQUIRE_TOTP === "true";
  const isolatedProject = process.env.TIME2PAY_TOTP_TEST_PROJECT_ID;
  const setupEnabled = process.env.TIME2PAY_TOTP_SETUP_ENABLED === "true" && (
    process.env.VERCEL_ENV === "production" || Boolean(
      isolatedProject && isolatedProject !== "time2pay-c5c5c" && isolatedProject === process.env.FIREBASE_PROJECT_ID &&
      isolatedProject === process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    )
  );
  return { required, setupEnabled };
}

export function mfaAccessError(
  token: Pick<DecodedIdToken, "firebase" | "email_verified">,
  user: Pick<UserRecord, "multiFactor" | "disabled">,
  required = getMfaConfiguration().required,
): "account_disabled" | "email_verification_required" | "mfa_setup_required" | "mfa_required" | null {
  if (user.disabled) return "account_disabled";
  const enrolled = user.multiFactor?.enrolledFactors ?? [];
  if (!required && enrolled.length === 0) return null;
  if (!token.email_verified) return "email_verification_required";
  if (!enrolled.some(factor => factor.factorId === "totp")) return "mfa_setup_required";
  // The signed Firebase claim is proof; client-supplied flags/codes are never trusted.
  if (token.firebase?.sign_in_second_factor !== "totp") return "mfa_required";
  return null;
}

export function isRecentSignIn(authTime: number, now = Date.now() / 1000) {
  return Number.isFinite(authTime) && authTime <= now + 30 && now - authTime <= 300;
}

