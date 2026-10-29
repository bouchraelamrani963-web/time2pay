# Queued security notices and the send window

A security event's creation time is not the start of a provider's idempotency
retention window. A notice waiting for a dispatcher or scheduled sweep can be
older than the retry window before its first send is attempted.

Persist `firstAttemptAt` under the winning send lease before contacting the
provider. The 23-hour retry limit starts at that timestamp. Preserve the original
event time in the email, the existing idempotency key and the timestamp across
all retries. Never extend an attempted notice's deadline just because its lease
expired or a worker restarted.

The additive migration backfills already-attempted notices with their event
time, retaining their earlier conservative deadline. Unattempted notices remain
unset until a worker acquires their first lease. A legacy or interrupted notice
that already has attempts but no timestamp uses its event time; it cannot gain
a fresh window. Expired or exhausted attempts remain available for manual review.

CI covers a notice queued for 25 hours, provider failure and retry, a stable
idempotency key/event time, legacy ambiguity, concurrent PostgreSQL leases and
preservation of existing rows during migration.

This does not guarantee immediate delivery during a prolonged outage. A crash
after claiming the first attempt can remain ambiguous; an expired window must
not be reopened. Operators must monitor manual-review and dispatch-failure logs.
An accepted provider request is not proof of inbox delivery. Do not enable a
production rollout without testing the actual dispatch/sweep and rollback paths.
