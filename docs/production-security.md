# Production recovery preparation — 26 October 2026

This prepares a separately gated Production path for the existing Firebase TOTP and recovery implementation. It does not deploy to Production, enable MFA there, generate real account codes or modify any production database record. Preview retains its exact isolated branch/Firebase/Neon checks. No new authentication system, email factor, support-reset endpoint or reserve authenticator is added.

## Configuration and activation

Production requires all of the following, not copied Preview flags:

- `VERCEL_ENV=production`, `TIME2PAY_RECOVERY_ENABLED=true`, `TIME2PAY_RECOVERY_DATABASE_ID=time2pay-production`.
- `TIME2PAY_REQUIRE_TOTP=true` and `TIME2PAY_TOTP_SETUP_ENABLED=true`.
- The existing production Firebase project `time2pay-c5c5c` in both server/browser settings, its Admin service account, its private credential and its public web key.
- Pooled and direct database URLs bound to the inventoried production endpoint `ep-withered-flower-alwyxd3z.c-3.eu-central-1.aws.neon.tech`, database `neondb`, with `sslmode=require`. Public identifiers are not credentials. Independently confirm that the actual deployed Production configuration matches this inventory before enabling; metadata inspection alone has not yet proven this binding.
- A new random recovery HMAC secret of at least 32 bytes, kept server-side in Production only. Retain it securely: losing/rotating it invalidates existing code hashes. Never copy the Preview pepper.
- A separate random `CRON_SECRET` of at least 32 bytes, distinct from the HMAC secret.
- `TIME2PAY_SECURITY_NOTICES_ENABLED=true`, the existing production Resend credential and verified sender. Keep Preview/test credentials and test-mail mode absent.
- No test Firebase project/service-account override or Preview retry-probe setting in Production.

Do not enable these flags until actual Firebase Identity Platform TOTP availability, domain/API-key restrictions, database binding, migrations, sender delivery, Workflow and Cron dispatch have been verified. No real users or test accounts may be enrolled/reset merely to check configuration. Existing users need a deliberate verified-email/TOTP enrollment rollout using their existing Firebase identities, not a data migration or new identities.

## Recovery locks and rollback

Production always requires TOTP, including when its enforcement flag is accidentally missing or false. Firebase Admin refuses copied test-project credentials before creating or reusing an application.

Normal Production authentication always reads the persisted account recovery lock, even when recovery is temporarily disabled or its configuration is incomplete. An unavailable lock table/database fails authentication closed. This requires additive migrations before deploying the new application. A provider custom claim independently denies pending recovery, but a database lock must also protect the interval before a provider mutation succeeds. Disabled recovery rejects session exchange for an existing locked account, including if its provider claim is missing during interrupted recovery.

Preview lock reads remain bound to the original isolated database and project, even while its feature flag is off. Test-probe UI/API use the explicit Preview gate and return unavailable in fully configured Production. The mail worker only performs synthetic first-attempt failure injection in the isolated Preview.

Retain a rollback build with these same lock checks. The old live commit `c8a4511` predates this protection and is not a safe rollback after recovery is used. Rollback must preserve all additive tables, HMAC secret, pending recovery state and issue history. Never clear factors, delete recovery locks, drop tables or disable MFA to repair a failed release.

## Backup and database prerequisites

Observed on 26 October 2026: Neon project `wispy-pond-46765289` is on `free_v3`, with six hours of history, no automatic snapshot schedule and one manual snapshot from 30 June 2026. A new pre-release snapshot was refused because the snapshot limit is reached. Preservation and restoration-verification branches exist but are unprotected. The restore-verification copy matches the original customer, invoice, item and company row fingerprints; that is a branch-copy drill, not proof of a protected independent backup.

The production source still has its original five tables. Additive issuance, service-rate/ORT, recovery and notice-retry migrations were rehearsed on a separate copy. Resolve the existing `_prisma_migrations` baseline drift deliberately before `prisma migrate deploy`; never use `db push`, reset the database, or mark new migrations applied without checking the exact schema. Keep existing Firebase UIDs and owner links. Existing issued invoices need an explicit preservation/baseline decision; do not relabel or bill them silently.

A current protected backup and an independently verified restore are still release blockers. Do not delete the sole old snapshot or buy capacity without the owner's explicit decision. Protected Neon branches require a paid plan; an alternative is an independently retained encrypted logical backup with separately managed recovery material and a tested restore. No such external backup destination/key management has been supplied or provisioned in this task.

## Verification and remaining acceptance

Run the full test suite, TypeScript, build and dependency audit. CI runs database-backed production-mode recovery with public synthetic configuration, mocked Firebase and a disposable localhost Postgres connection; it never connects those fixtures to production. This covers initial codes, reset, revocation call, disabled-flag lock enforcement, new-factor completion, hash rotation and old-code rejection. Provider mocks are not proof of real production session revocation.

Before release, retain independent old-session rejection evidence from isolated Firebase, verify actual support-denial behavior, production mail retry/sweep monitoring, protected restore and production configuration. The owner confirmed Preview PDF/print on 26 October 2026. Real payments remain off; the three-month launch timestamp must be set only at the actual successful release, and the synthetic Preview timestamp must never be copied.
