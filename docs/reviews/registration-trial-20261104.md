# Registration and trial review — 4 November 2026

Base: seo/time2pay-facturatie-20261103, bb4e309. This matches the latest production deployment metadata returned by Vercel. main is older and is deliberately not the PR base.

## Findings
- Live homepage and /register?plan=starter inspected read-only. Hero, closing CTA and navigation lead to pricing; only package links lead to registration. On mobile the original navigation also hides login.
- Production project configuration read without decrypting secrets: TIME2PAY_REGISTRATION_TRIAL_ENABLED=true, TIME2PAY_LAUNCHED_AT=2026-11-02T10:47:06.983Z, TIME2PAY_LIVE_PAYMENTS_ENABLED=false. These are current project settings; the effective deployment environment was not independently extracted. Live page copy is consistent with an enabled launch offer.
- Existing server policy: three calendar months from configured launch; at least 30 elapsed days from Firebase creationTime, whichever ends later. Configured launch interval is 2 November 2026 11:47:06.983 through 2 February 2027 11:47:06.983 Europe/Amsterdam. No reset on login/recovery. This is a shared campaign window, not three months after each registration.
- Registration uses Firebase createUserWithEmailAndPassword, optional display name, then server session. Verified email and TOTP are required in production before dashboard access. No payment input or Stripe checkout in registration. Active free access blocks checkout before Stripe side effects. Expiry itself creates no subscription; separately purchased subscriptions can renew under their own terms.
- Starter quota is currently 30 first-issued invoices per paid subscription period, not 15; repeated export/send does not consume a second slot. No quota or entitlement changes made. Owner decision remains 15 versus 30.
- Registration plan query currently does not activate a plan. Existing unlimited and multi-user marketing claims removed because those rights were not established by this review.

## Prepared changes
Direct registration CTA in hero, closing section and navigation; login accessible on mobile. Shared offer copy above prices and in registration, derived from existing policy with dates in Dutch time; accurate fallback when disabled, missing, future or expired. Existing €9/€19/€39 prices retained. Added email verification/TOTP explanation. No auth, billing, quota, database or production configuration changes.

## Validation
- npm ci --ignore-scripts; Prisma client generation only, no migration or database connection.
- npx tsc --noEmit: pass.
- node --test tests/*.test.cjs tests/*.test.mjs: 169 total, 158 pass, 11 skipped, zero failures. Skips require PostgreSQL integration fixtures. New tests cover date boundaries, late registration, CTA routes, fictional registration and mandatory MFA redirect. Existing isolated mocks cover auth/session policy, trial entitlement, Starter quota and blocked trial checkout.
- TIME2PAY_LIVE_PAYMENTS_ENABLED=false TIME2PAY_CONFIGURE_TEST_TOTP=false npm run build: pass.
- git diff --check: pass.
- Local production server starts successfully. Connected browser is on another device and cannot reach the workspace localhost (connection refused); no desktop/mobile visual sign-off claimed.
- No real Firebase test account created; external Firebase/TOTP/email/dashboard end-to-end acceptance remains unproven. Production registration therefore cannot be certified from these mocked tests alone.

## Release gates
No deployment, publication, production registration, Firebase configuration changes, Stripe activation or migration. Branch-specific Vercel automatic deployments disabled in vercel.json before pushing. PR remains draft pending isolated external-auth acceptance, mobile/desktop visual review, Starter decision and separate merge/release approval.
