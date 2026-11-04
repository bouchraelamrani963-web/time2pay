// QA harness only. This file and its integrations are not a production release.
export const QA_FIREBASE_PROJECT = "time2pay-isolated-qa-20261030";
export const QA_DATABASE_NAME = "time2pay_auth_qa";
type Env = Record<string, string | undefined>;

export function assertIsolatedQa(env: Env, now = Date.now(), requireToken = false) {
  if (env.TIME2PAY_ISOLATED_QA !== "true") return null;
  const fail = () => { throw new Error("Isolated QA configuration rejected"); };
  if (env.VERCEL_ENV === "production" || env.VERCEL_PROJECT_ID ||
      env.NEXT_PUBLIC_TIME2PAY_ISOLATED_QA !== "true" ||
      env.FIREBASE_PROJECT_ID !== QA_FIREBASE_PROJECT ||
      env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== QA_FIREBASE_PROJECT ||
      env.TIME2PAY_TOTP_TEST_PROJECT_ID !== QA_FIREBASE_PROJECT ||
      env.TIME2PAY_REQUIRE_TOTP !== "true" || env.TIME2PAY_TOTP_SETUP_ENABLED !== "true" ||
      env.TIME2PAY_CONFIGURE_TEST_TOTP !== "false" ||
      env.TIME2PAY_REGISTRATION_TRIAL_ENABLED !== "true" ||
      env.TIME2PAY_LIVE_PAYMENTS_ENABLED !== "false" ||
      env.TIME2PAY_RECOVERY_ENABLED !== "false" || env.TIME2PAY_SECURITY_NOTICES_ENABLED !== "false") fail();
  // No inherited production/provider secrets, emulators or long-lived keys.
  for (const [key, value] of Object.entries(env)) {
    if (value && (/^(STRIPE_|RESEND_)/.test(key) || [
      "FIREBASE_PRIVATE_KEY", "FIREBASE_PRIVATE_KEY_BASE64", "FIREBASE_TEST_SERVICE_ACCOUNT_JSON",
      "GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_AUTH_EMULATOR_HOST", "INVOICE_FROM_EMAIL",
      "TIME2PAY_EMAIL_MODE", "TIME2PAY_BILLING_MODE",
    ].includes(key))) fail();
  }
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    let url: URL;
    try { url = new URL(env[key] || ""); } catch { return fail(); }
    if (!["postgres:", "postgresql:"].includes(url.protocol) ||
        !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "55432" ||
        url.pathname !== `/${QA_DATABASE_NAME}` || url.username !== "qa_runner" ||
        url.search || url.hash) fail();
  }
  if (requireToken) {
    const expiresAt = Date.parse(env.TIME2PAY_QA_ACCESS_TOKEN_EXPIRES_AT || "");
    if (!env.TIME2PAY_QA_ACCESS_TOKEN || !Number.isFinite(now) || !Number.isFinite(expiresAt) ||
        expiresAt <= now + 30_000 || expiresAt > now + 3_600_000) fail();
  }
  return { projectId: QA_FIREBASE_PROJECT };
}

export function isolatedQaCredential(env: Env, clock = Date.now) {
  if (!assertIsolatedQa(env, clock(), true)) throw new Error("Isolated QA is disabled");
  return {
    getAccessToken: async () => {
      assertIsolatedQa(env, clock(), true);
      return { access_token: env.TIME2PAY_QA_ACCESS_TOKEN!,
        expires_in: Math.floor((Date.parse(env.TIME2PAY_QA_ACCESS_TOKEN_EXPIRES_AT!) - clock()) / 1000) };
    },
  };
}
