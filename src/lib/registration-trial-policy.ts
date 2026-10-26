// Registration always grants 30 elapsed days, anchored to Firebase creation time.
export const REGISTRATION_TRIAL_MS = 30 * 24 * 60 * 60 * 1000;
export function registrationTrial(creationTime: string | undefined, now = Date.now()) {
  if (!creationTime || !Number.isFinite(now)) return null;
  const start = Date.parse(creationTime);
  const end = start + REGISTRATION_TRIAL_MS;
  if (!Number.isFinite(start) || start > now || now >= end) return null;
  return { periodStart: Math.floor(start / 1000), periodEnd: Math.floor(end / 1000) };
}

// A fixed, server-configured launch timestamp; never infer launch from a deploy,
// login, first request or process start. Three calendar months in UTC, clamped
// to the last day of the target month (e.g. January 31 -> April 30).
export function launchTrialPeriod(launchedAt: string | undefined) {
  if (!launchedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(launchedAt)) return null;
  const start = Date.parse(launchedAt);
  if (!Number.isFinite(start) || new Date(start).toISOString() !== launchedAt) return null;
  const end = new Date(start);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 3);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return { periodStart: start / 1000, periodEnd: end.getTime() / 1000 };
}

export function freeTrial(creationTime: string | undefined, launchedAt: string | undefined, now = Date.now()) {
  if (!creationTime || !Number.isFinite(now)) return null;
  const registeredAt = Date.parse(creationTime);
  if (!Number.isFinite(registeredAt) || registeredAt > now) return null;
  const registration = registrationTrial(creationTime, now);
  const launch = launchTrialPeriod(launchedAt);
  const activeLaunch = launch && launch.periodStart * 1000 <= now && now < launch.periodEnd * 1000 ? launch : null;
  if (!registration && !activeLaunch) return null;
  return {
    periodStart: Math.floor(registeredAt / 1000),
    periodEnd: Math.floor(Math.max(registration?.periodEnd ?? 0, activeLaunch?.periodEnd ?? 0)),
  };
}
