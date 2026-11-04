# PR #22 release review — 4 November 2026

## Decision: NO-GO for release
The real Firebase QA registration → verified email → TOTP enrollment → fresh login → authorized dashboard/free access sequence has NOT been completed. Keep PR #22 draft. Do not infer provider acceptance from mocks, PostgreSQL CI or the visual snapshot.

## Confirmed product decisions and copy
- Owner confirmed Starter: 30 first-issued invoices per subscription period. Existing quota logic unchanged; marketing now uses the same period terminology. Repeated export/send does not consume another invoice.
- Removed the headline promising three months per registration. Shared headline now explicitly states the configured campaign end. Detail guarantees at least 30 elapsed days from Firebase account creation and explains that the later of the campaign end and registration-plus-30-days applies. It explicitly states that each signup does not get three full months.
- Production project settings inspected read-only: launch 2026-11-02T10:47:06.983Z, trial enabled, live payments disabled. Campaign end follows the existing three-calendar-month policy: 2 February 2027 11:47:06.983 Europe/Amsterdam. Effective deployment variables were not independently extracted.
- Prices retained: Starter €9, Pro €19, Business €39 monthly. Registration and plan links create no paid subscription. Free expiry does not create one either. Existing separately purchased subscriptions have their own renewal terms.

## Source and integration
Base release branch: seo/time2pay-facturatie-20261103 at bb4e309c4b246309d79942c6f7ff8240edc6ffad. Production project metadata still reports that deployment; main is older.
GitHub reports mergeable=true. Local git merge-tree --write-tree against the actual base and d36e7f671a09dac1480e15e126a0357f8476e5de succeeded without conflicts. No merge performed. Branch-specific Vercel automatic deployment remains disabled.

## PostgreSQL and CI evidence
Previous 11 skips were guarded by TIME2PAY_RECOVERY_DB_TEST=true and require a localhost database named time2pay_recovery_ci. No local PostgreSQL/Docker binaries were installed; OS identity restrictions prevented installing a local server. Used the repository's existing disposable GitHub Actions PostgreSQL services instead. Expanded its pull_request base-branch selector to include the actual release branch. No production/test customer data or service secrets used.

Run: https://github.com/bouchraelamrani963-web/time2pay/actions/runs/41805886729
Tested application commit: d36e7f671a09dac1480e15e126a0357f8476e5de.
All three jobs succeeded: recovery, migration-chain, dependencies.
- 169 tests passed, zero failed, zero skipped, including all 11 actual PostgreSQL integration tests.
- Covers scoped recovery-code hashes, one-time concurrent use, session/recovery locks, expiry, cross-account protection, distributed rate limits, support isolation, simulated provider failure, concurrent outbox delivery, real advisory locks allowing 30 Starter issues and rejecting issue 31, and production-mode recovery rules using synthetic identities.
- Disposable PostgreSQL 16 recovery migration/data-preservation/backup-restore rehearsal passed.
- Disposable PostgreSQL 17 complete versioned migration chain/status/schema comparison passed.
- TypeScript, production build, built-HTTP security headers and dependency audit passed.
- Local tests: 158 passed with the 11 database tests intentionally skipped locally; local TypeScript and clean production build passed. Initial local build cache error was resolved by moving aside the disposable .next output and rebuilding cleanly.

## Visual inspection
Dedicated project: time2pay-pr22-visual-qa (prj_DK2OA6Iy76Sq1MFbSgG4qWhZ3dHk). It contains server-rendered HTML/CSS/logo snapshots from the PR application build only. No JavaScript, API, Firebase configuration, database, payment connection or credentials. CSP denies scripts, network connections and form submission; noindex/nofollow enabled. It is a visual fixture, not a functional QA app.
Staging preview: https://time2pay-pr22-visual-iwliufdzy.vercel.app
- Inspected homepage, navigation, pricing and registration at 1440×1000 and 390×844; additionally checked 320×720 for overflow. No horizontal page overflow observed. Mobile nav wraps and retains login and registration access. Inputs and submit button fit the mobile container.
- Desktop pricing cards are side-by-side; mobile cards stack. Links lead to the local snapshot registration page, including Starter query parameter. No signup submitted.
- Found fixed-nav overlap at pricing anchor; added scroll-mt-40 to pricing, features and how-it-works sections. This follow-up is CSS only and requires the latest visual fixture to confirm the correction.
- Hosting note: the API assigned the first deployment in this completely separate static-only project the target label `production` when target was omitted. A second deployment explicitly uses `staging`. Cancellation of the first completed deployment was refused. This did not deploy to or modify the real Time2Pay project, domains, credentials, database or users. Do not describe it as a real application release.

## Firebase QA: observed and blocked
Inspected only time2pay-isolated-qa-20261030 in the Firebase console, 4 November 2026:
- Spark/no-cost plan, Email/Password enabled, users list explicitly empty.
- Console showed SMS multi-factor status Enabled; this does not prove TOTP readiness. No SMS sent, provider configuration changed or user created.
- Existing Vercel application preview settings are for the older preview environment, not proven bound to this QA project. They were not reused. No secured full-stack instance of this PR bound to the named QA Firebase project and an empty isolated database was established.
- No new Admin credentials generated or production credentials copied. No user password, authenticator seed, OTP or recovery code collected.
- Therefore zero of the allowed maximum one fictitious users was created. Registration, real verification delivery/action, TOTP setup, fresh login, server session and dashboard/free entitlement remain unproven against this real provider.

## Required before release
Provide a protected full-stack QA instance of this commit, explicitly bound to time2pay-isolated-qa-20261030 and an empty disposable database with reviewed migrations, live payments and external customer email disabled. Provision existing QA-only Admin access securely, verify effective Firebase/TOTP project binding, then complete exactly one controlled fictitious account through the real application. The owner enters credentials/authenticator values herself under the established handoff preference. Prove verified email, TOTP enrollment, logout/fresh TOTP login, server-authorized dashboard and free entitlement; never substitute manually marking email verified for a verification-flow test. Then rerun release assessment.

No production account, configuration, database, billing or real Time2Pay deployment changed. No PR merge.
