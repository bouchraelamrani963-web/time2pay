# TOTP recovery draft — 24 October 2026

Status: NOT RELEASED. Recovery endpoints and pages are disabled by default and cannot be enabled in Production by this draft. No migration on Preview/Production, real account reset or new credential configuration has been performed. CI rehearses the additive SQL against its own disposable database and compares the resulting schema. Local dependency audit is now zero across all packages; 65 non-database tests, TypeScript and the Next 16 build pass. Ten PostgreSQL/provider-mocked database tests run in disposable CI; Firebase practice tests remain outstanding. Do not claim browser/provider acceptance from source inspection or CI mocks.

## Existing integration retained

Firebase Auth email/password remains the first factor; Firebase TOTP is the only second factor. Existing QR enrollment and MultiFactorResolver are reused. Address-verification email remains account setup, never a second factor. Recovery notices contain no login code or approval link. There is no new password database, custom login token, email OTP or security question.

The server verifies recovery passwords through the existing project's official accounts:signInWithPassword endpoint, binds its server-verified email (and localId/email when returned) and enrolled MFA identifiers to Admin SDK user data, and never accepts a client-supplied UID or pending credential. The documented response must be verified against the actual isolated project (including API key/reCAPTCHA restrictions) before activation.

## Codes and access boundary

Ten unique 128-bit random codes, printable/downloadable once after the first fresh password + TOTP login following enrollment. Only purpose- and user-bound HMAC-SHA256 hashes persist, using a separate server secret. No plaintext codes in database, logs, URLs, storage, emails or recovery tickets. Lost display/network responses are not re-readable; regenerate after fresh TOTP login.

A password plus unused code consumes that code atomically under a PostgreSQL account advisory lock and commits a recovery lock. Firebase custom recovery lock is set, existing refresh tokens/sessions revoked, then factors cleared. These changes run under the same account lock to serialize reset/completion operations. Provider failure retains a locked state. An unused remaining code plus password may restart an interrupted or expired recovery; time alone never restores access.

A Secure HttpOnly SameSite=Strict __Host cookie carries a random, hashed, 15-minute, single-use enrollment grant. Normal app sessions remain denied throughout recovery. Completion requires that cookie, a new fresh Firebase password+TOTP login, the signed factor identifier matching an actually enrolled new factor, and the correct account. All old codes and grants are invalidated and ten new codes shown once. Old factor IDs cannot finalize recovery. Never delete pending recovery records or bypass locks to troubleshoot.

An added reserve authenticator uses the existing Firebase enrollment API after fresh password+TOTP authentication. No secret is exported from Firebase to create a duplicate factor. UI checks and confirms the new app, records a notice and revokes sessions. Verify both distinct factors end to end; a provider limit/unsupported configuration must be reported without weakening authentication.

## Abuse controls and notices

Recovery POSTs require exact same-origin JSON, bounded bodies and persistent HMAC-keyed account/email/IP limits. IP comes only from Vercel's platform-set x-vercel-forwarded-for; validate anti-spoofing on Preview. Limits: five email/account attempts per 15 minutes; 20 per source IP; three code regenerations/hour; two support requests/account/day. Unknown/incorrect/used codes share a generic failure response. The response never discloses account status, factors or code counts.

Events and notification outbox are committed with security changes. Mail reuses isolated Preview mail configuration and is forced to delivered@resend.dev; failures retain unsent notices. A durable Workflow worker now retries with 1m/5m/15m/1h/3h/6h delays, finite HTTP timeouts, atomic send leases, stable provider idempotency keys and a 23-hour delivery window. Only opaque notice IDs and retry timestamps enter the Workflow event log; no credentials, email addresses or recovery codes. `sentAt` records provider acceptance, never confirmed inbox delivery. Exhausted/expired notices remain in a dead-letter state with structured opaque-ID logs for manual review; provider error text is not persisted.

Set TIME2PAY_SECURITY_NOTICES_ENABLED=true only after applying both recovery/outbox migrations, isolated Resend configuration and a strong server-only CRON_SECRET. The worker uses the existing Preview mail sink. The authenticated /api/internal/security-notices sweeper dispatches stranded rows and restarts failed Workflow runs. vercel.json prepares a daily production sweep; Vercel Cron does not run automatically on Preview, so an independently scheduled authenticated Preview sweep is still a release test requirement. Normal provider failure retries run durably without another visitor request. Monitoring/retention and actual Preview worker/provider recovery evidence remain required. Never claim automatic delivery has been proven from mocks. Never treat notification email as authentication or ownership evidence.

## Support policy — default deny

The form accepts the current password through Firebase, a contact address and a bounded description. The contact address is for correspondence only, never proof. Requests persist as REVIEW_REQUIRED. Intake has NO endpoint that resets MFA and does not promise restoration.

Before a human-assisted reset can exist operationally:
- Establish evidence independent of the lost mailbox and known biographical/company/billing data. A new identity document alone does not prove a previously unverified Time2Pay account belongs to that person.
- Bind cryptographic or equivalent strong proof to a previously established, reliably verified account ownership record. No such baseline has been demonstrated for existing users.
- Two separate authorized operators, each freshly authenticated with TOTP, must review the evidence and record a reason and evidence reference in an access-controlled audit trail; a second reviewer is a control, not proof itself.
- Reject if ownership cannot reliably be established, regardless of waiting time, pressure or familiarity. Do not accept emailed passwords, recovery codes, identity scans or security answers.
- Notify the existing verified contact about request and outcome. Never send a new credential to an unverified replacement address.
- Any approved reset must use the same locked/revoked/new-TOTP path, not a password-only session.

This draft implements secure intake, not an operational approval/reset tool. Until independent proof and reviewer authorization are implemented and tested, support must reject unprovable requests and cannot reset 2FA through the application.

## Test and release gates

New GitHub checks use a disposable localhost PostgreSQL database. They contain public synthetic credentials only and cannot access production. Tests cover code format/uniqueness/hash scoping, strict Preview config, signed new factor/current factor checks, same-origin/size limits, disabled endpoints, initial one-time display, real PostgreSQL race/reuse, expiry/restart, cross-user isolation, rate locks, support-no-reset, and existing auth/billing/rate behavior. Provider APIs and mail are mocked in CI.

Before any integration/activation:
1. Check test/build results at exact commit; fix existing dependency audit findings. No release with failed critical checks.
2. Rehearse additive migration in a restored isolated test copy; preserve existing users/invoices. No prisma db push against Production.
3. Configure recovery only on isolated Preview with explicitly matching project/database, mandatory TOTP, separate random hash secret (at least 32 bytes). Do not put secrets in GitHub, logs or this document.
4. Test real registration/address verification, initial QR enrollment + ten-code display/download/print, normal password+TOTP login, second authenticator and both choices.
5. Test loss of authenticator, used/incorrect code, simultaneous requests, expired/forged/stolen grant from another account, browser refresh/lost cookie, interrupted Firebase operations, existing session revocation, provider outage and reCAPTCHA/API key restrictions.
6. Verify every protected API/page denies password-only and pending-recovery tokens; test a removed factor, disabled account, global flag off, rollback and CSRF.
7. Prove the notification Workflow and independently scheduled Preview sweep against real isolated infrastructure; configure dead-letter monitoring and retention. Complete operator access/strong ownership policy and support denial/outcome tests. No admin reset shortcut.
8. Restore-tested production backup, production-only credentials, explicit rollout design for existing MFA users, and final production checks remain required. This draft deliberately cannot enable production recovery.

Rollback must preserve the additive tables and enforce the custom recovery lock. Do not roll back to a version that ignores it or unset/delete pending recovery state; a failure requires controlled repair, never automatic unlock.

References checked 24 October 2026:
- https://firebase.google.com/docs/auth/web/totp-mfa
- https://firebase.google.com/docs/auth/admin/manage-mfa-users
- https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/signInWithPassword
- https://firebase.google.com/docs/reference/admin/node/firebase-admin.auth.decodedidtoken

## Preview evidence — 25 October 2026

PR7 was merged only into codex/time2pay-stripe-test (912f608); main/Production unchanged. CI run 40107393088 passed 75 tests, full zero-advisory audit, TypeScript, build and an actual disposable PostgreSQL dump/restore. Provider boundaries in those tests remain mocked.

The exact additive issuance/recovery/outbox SQL was rehearsed on Neon test-project red-block-41592881, branch br-royal-pine-bauhzwy9, then applied to its sandbox branch br-floral-mountain-ba0yj69i. Snapshot snap-divine-queen-baptfqrs retains the prior state until 31 October 2026 15:45 UTC; the rehearsal branch expires at the same time. Row counts and full-row fingerprints remained identical for all five original tables: 2 clients, 2 invoices, 3 invoice items, 2 billing accounts, 0 company settings. This is test data preservation, not a production restore proof. Existing manually applied migrations still require a deliberate Prisma baseline before production rollout.

The first deployed Next16/Firebase14 Preview exposed an upstream jwks-rsa require(ESM) compatibility failure. A scoped jose5 override and a regression test running without experimental require(ESM) preserve real JWKS signature validation, including rejection of a forged token. The complete dependency audit remains zero. Runtime re-verification must succeed before enabling recovery.

Recovery now checks the actual pooled/direct URL host and database against the independently inspected test Neon endpoint, plus the exact sandbox Git branch. A copied database label alone cannot enable recovery on another database. No production secret is retrieved or modified.
