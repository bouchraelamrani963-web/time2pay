type Environment = Record<string, string | undefined>;

// Inherited Production settings must not expose a reset form in another Preview.
export function passwordResetAvailable(env: Environment) {
  if (env.VERCEL_ENV === "production") {
    return env.FIREBASE_PROJECT_ID === "time2pay-c5c5c" &&
      env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "time2pay-c5c5c" &&
      !env.TIME2PAY_TOTP_TEST_PROJECT_ID && !env.FIREBASE_TEST_SERVICE_ACCOUNT_JSON;
  }
  return env.VERCEL_ENV === "preview" &&
    env.VERCEL_GIT_COMMIT_REF === "codex/time2pay-stripe-test" &&
    env.TIME2PAY_TOTP_TEST_PROJECT_ID === "time2pay-preview" &&
    env.FIREBASE_PROJECT_ID === "time2pay-preview" &&
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "time2pay-preview";
}

export const PASSWORD_RESET_NOTICE = "Als dit e-mailadres bij een account hoort, ontvang je een e-mail met een link om je wachtwoord opnieuw in te stellen. Controleer ook je spammap.";

export function passwordResetError(error: unknown): string | null {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  // Preserve the same visible response when Firebase does disclose non-existence.
  if (code === "auth/user-not-found") return null;
  if (code === "auth/invalid-email") return "Vul een geldig e-mailadres in.";
  if (code === "auth/too-many-requests") return "Te veel aanvragen. Wacht even voordat je opnieuw probeert.";
  if (code === "auth/network-request-failed") return "Geen verbinding. Probeer het later opnieuw.";
  return "De herstelaanvraag is niet gelukt. Probeer het later opnieuw.";
}
