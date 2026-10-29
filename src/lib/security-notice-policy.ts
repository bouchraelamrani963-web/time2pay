// Retries remain within Resend's 24-hour idempotency retention window.
export const NOTICE_MAX_AGE_MS = 23 * 60 * 60 * 1000;
export const NOTICE_RETRY_SECONDS = [60, 300, 900, 3600, 10800, 21600] as const;
export function noticeRetryAt(attempts: number, firstAttemptAt: Date, now: Date): Date | null {
  const seconds = NOTICE_RETRY_SECONDS[attempts - 1];
  if (!seconds || now.getTime() + seconds * 1000 >= firstAttemptAt.getTime() + NOTICE_MAX_AGE_MS) return null;
  return new Date(now.getTime() + seconds * 1000);
}
