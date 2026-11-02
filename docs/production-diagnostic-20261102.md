# Time2Pay production diagnostic — preparation only (2 November 2026)

**NO-GO. This branch does not authorize any production execution or deployment.**

Base release commit: `2244dad88831e95f1e6ff47c51b7569bf4bc0be9`.
Branch: `diagnostics/time2pay-prod-readonly-20261102`.
Automatic Vercel Git deployment for this branch is disabled in `vercel.json`.

## Purpose
- Standalone Node.js script in `scripts/diagnose-production-config.cjs`, not included in the app's routes, cron or build pipeline.
- Does not expose a public endpoint. No production state or user records are changed.
- It requires BOTH a verified production context (`VERCEL_ENV=production`) and explicit one-time execution opt-in (`TIME2PAY_DIAGNOSTIC_APPROVED=true`). The flag must NOT be added to persistent production variables. Normal invocation prints only `DIAGNOSTIC_GUARD: BLOCKED`.
- Refuses remote access when `TIME2PAY_LIVE_PAYMENTS_ENABLED` is not exactly `false`.
- Checks whether both environment URL values point to the independently identified Neon production host (direct or pooler) and database `neondb`. Values remain in memory and are never printed.
- Performs ONLY `SELECT current_database()` through the actual supplied application DATABASE_URL, without accessing customer records.
- Checks the Firebase client/admin project identity and reads Firebase MFA provider configuration with `getProjectConfig()` only. TOTP must show `ENABLED`; IAM failures yield UNKNOWN.
- Reports only PASS, FAIL, UNKNOWN or NOT_RUN for fixed check names, without emitting secrets, raw errors, query results or provider configuration.

## Before any execution, require separate approval
1. Establish a genuinely authorized runtime with the **effective** production environment. A preview/staging build does not prove the active production deployment's settings.
2. Verify the Neon endpoint still maps to the production branch. Avoid stale hostname assumptions if compute endpoints are replaced.
3. Confirm secure capture of status-only output, egress/network constraints, Firebase project-config read permission, and no logging of environment values.
4. Do not expose a new public route, do not change persistent Vercel/Firebase/Neon variables, do not deploy to the public domain merely to run a diagnostic.
5. This script performs a read-only database query, but opening a connection and reading project configuration may still generate audit logs.
6. If direct authorized runtime execution cannot be supplied, return NO-GO rather than claiming PASS.

## Offline tests and release
Run `node --test tests/production-diagnostic.test.cjs` in an isolated development checkout; tests don't access production.
No product migration, deployment, payment activation, merge or account modification is permitted by this preparation.
Release `2244dad` remains NO-GO until the independent diagnostic, approved migration, production-configured validation and rollback planning are complete.

**Limit:** these checks do not establish that the live public artifact itself ran the script. That provenance must be independently proved.
