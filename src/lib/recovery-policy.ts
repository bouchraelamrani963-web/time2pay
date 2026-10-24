import type { DecodedIdToken, UserRecord } from "firebase-admin/auth";
import { isRecentSignIn } from "./auth-policy";

export function signedTotpFactor(token: DecodedIdToken, user: UserRecord) {
  const id = token.firebase?.second_factor_identifier;
  return !user.disabled && user.emailVerified && token.email_verified === true &&
    token.firebase?.sign_in_provider === "password" &&
    token.firebase?.sign_in_second_factor === "totp" && typeof id === "string" &&
    isRecentSignIn(token.auth_time) &&
    user.multiFactor?.enrolledFactors.some(f => f.factorId === "totp" && f.uid === id) ? id : null;
}
export function mayCompleteRecovery(token: DecodedIdToken, user: UserRecord, state: {
  status: string; startedAt: Date | null; expiresAt: Date | null; oldFactors: string[];
}, now = Date.now()) {
  const factor = signedTotpFactor(token, user);
  return !!factor && state.status === "ENROLLMENT_REQUIRED" &&
    !!state.startedAt && !!state.expiresAt && state.expiresAt.getTime() > now &&
    token.auth_time > Math.floor(state.startedAt.getTime() / 1000) &&
    !state.oldFactors.includes(factor) &&
    user.multiFactor?.enrolledFactors.length === 1;
}
