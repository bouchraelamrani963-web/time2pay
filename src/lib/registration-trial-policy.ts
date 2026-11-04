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

// Public copy uses the entitlement policy's clock; never hardcode campaign dates.
export function trialPresentation(enabled: boolean, launchedAt?: string, now = Date.now()) {
  const launch = launchTrialPeriod(launchedAt);
  const active = enabled && launch && launch.periodStart * 1000 <= now && now < launch.periodEnd * 1000;
  const format = (seconds: number) => new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(new Date(seconds * 1000));
  return {
    headline: active ? "Probeer Time2Pay 3 maanden gratis." : enabled ? "Probeer Time2Pay 30 dagen gratis." : "Maak gratis een account aan.",
    detail: active
      ? `De introductieperiode loopt vanaf livegang op ${format(launch.periodStart)} tot ${format(launch.periodEnd)} (Nederlandse tijd). Je krijgt vanaf registratie minimaal 30 dagen gratis; de laatste einddatum geldt.`
      : enabled ? "Je gratis periode begint bij het aanmaken van je account en duurt 30 dagen."
      : "Registreren en conceptfacturen opstellen is gratis. Voor verzenden, definitieve PDF en afdrukken is een betaald abonnement nodig.",
    after: enabled ? "Geen betaalgegevens nodig. Je proefperiode wordt niet automatisch een betaald abonnement. Na afloop kies je zelf een abonnement voor verzenden, definitieve PDF en afdrukken; concepten blijven gratis." : "Een betaald abonnement sluit je zelf afzonderlijk af.",
  };
}
