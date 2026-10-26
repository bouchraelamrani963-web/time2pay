import "server-only";
import { getAdminAuth } from "./firebase-admin";
import { freeTrial, launchTrialPeriod } from "./registration-trial-policy";

// Roll out in isolated Preview first; Production must opt in at release.
export function registrationTrialEnabled() {
  return process.env.TIME2PAY_REGISTRATION_TRIAL_ENABLED === "true";
}
export function launchOfferAvailable() {
  if (!registrationTrialEnabled()) return false;
  const launch = launchTrialPeriod(process.env.TIME2PAY_LAUNCHED_AT);
  return !!launch && Date.now() < launch.periodEnd * 1000;
}
export async function getRegistrationTrial(userId: string) {
  if (!registrationTrialEnabled()) return null;
  try {
    const user = await getAdminAuth().getUser(userId);
    if (user.disabled) return null;
    const period = freeTrial(user.metadata.creationTime, process.env.TIME2PAY_LAUNCHED_AT);
    return period ? { ...period, subscriptionId: `trial:${userId}`, starter: false } : null;
  } catch {
    // Never substitute the current date or a client-supplied timestamp.
    return null;
  }
}
