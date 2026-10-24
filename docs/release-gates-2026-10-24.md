# Time2Pay release gate review — 24 October 2026

Decision: HOLD. Do not merge into main, promote a Preview deployment, or enable live payments. The owner explicitly requires proof of the important controls before publication.

## Changes prepared in this draft

- Multiple free draft invoices. Draft creation no longer calls Stripe or consumes a free-invoice flag.
- Server-side subscription authorization for send, reminder, definitive PDF and status finalization; print opens that same authorized PDF.
- Starter allowance: 30 distinct invoice IDs per Stripe subscription period. Repeat PDF/send/reminder uses the existing issue record. Renewals use a new period bucket; Pro and Business do not inherit this cap.
- PostgreSQL transaction advisory lock serializes first issue and draft editing for an account. Issued invoice content cannot be changed or returned to draft through the invoice PATCH route. Deleting an invoice does not delete its allowance ledger entry.
- Conservative reservation: an issue attempt reserves its allowance before external delivery. A provider failure keeps the reservation and a retry of that same invoice does not consume another unit.
- Additive SQL migration and Prisma model for the allowance ledger. No existing production rows have been changed. Migration NOT applied in either environment in this review.
- PDF palette aligned with the refreshed site. Final visual/export QA remains pending.

## Evidence

Combined PR7 checks: the full dependency audit reports zero vulnerabilities after safe framework/Firebase/validation upgrades and patched transitive overrides. Next16 asynchronous request APIs and proxy routing are migrated. 65 non-database tests plus TypeScript and an optimized build pass locally; ten PostgreSQL tests, additive SQL schema equivalence, synthetic-data preservation and a dump/restore drill are required in CI. These are code-level and synthetic database checks, never proof of real Firebase/Stripe acceptance. PR5 branding is carried into the rate-aware shared email/PDF/view renderers; PR6 fixed rates and explicit optional ORT are preserved.

Vercel settings inspected through the signed-in dashboard. On the isolated `codex/time2pay-stripe-test` Preview branch, four branch-specific NEXT_PUBLIC_FIREBASE settings were missing and have now been added from the Firebase `time2pay-preview` web app configuration. Production settings were not changed. A Preview-only rebuild of ea27cde was requested so these values take effect. This does not deploy the new quota changes in this draft.

The Stripe configuration remains deliberately sandbox-only. Monthly test prices are Starter EUR 9, Pro EUR 19 and Business EUR 39. The application rejects Production/test credential mixing; live price IDs, live signing secret and live restricted key have not been configured or validated here. Dutch test VAT setup must not be treated as confirmation of the business's production tax obligations.

## Outstanding release blockers

1. Verify the rebuilt Preview actually uses `time2pay-preview` on browser and server, and test fresh registration, email verification, authenticator enrollment, six-digit TOTP login, invalid/reused code rejection and logout/session enforcement. Never migrate test Firebase accounts to Production.
2. Apply the additive migration to the isolated test database and exercise real concurrent 30th/31st issue requests, renewal boundaries, cancellation, failed renewals, retries and account ownership. Do not run `prisma db push` against Production.
3. Re-test customer CRUD, multiple drafts, save/reload, mail, final PDF and print end to end with synthetic data under the new Firebase UID. Earlier sandbox/mail checks predate this auth split and quota change.
4. Implement separately gated production Stripe configuration with correct account, live allowlisted recurring prices, verified tax/inclusive-price policy, signed webhook and environment isolation. Keep real payment creation disabled until the production flow has passed the required checks.
5. Obtain a restorable production database backup, validate restore in isolation, audit existing users/data and rehearse migrations. Existing draft/issued invoices need a deliberate baseline; the new ledger starts empty. Do not silently relabel or charge existing invoices.
6. Complete production security/dependency review and invoice-integrity review. Existing invoices still join mutable client/company details; final document snapshots need assessment before a claim of immutable invoice history. VAT-only recalculation is covered by the PR6 regression test.

## Rollback reference and release procedure

Observed current Production is main commit `c8a45112a6cf3c6453e0008cac3edad03b3931cc`, Vercel deployment `DJMAcBeBht6v1rMSi1rhC2fbbLMw`. Record and retain this deployment before release. This is an application rollback reference, NOT evidence of a tested data restore.

Before any publication: retain the prior deployment, take and restore-test the database backup, rehearse the additive migration, and record owner/data counts without exporting personal data into the repository. Build a staged Production deployment with Production credentials and verify it before attaching the live domain. Do not promote a Preview build containing baked-in test Firebase values. After release, verify domain, registration, login, draft CRUD, entitlement denial and authorized invoice operations, without real customer charges or mail. If an important check fails, leave the live domain on the prior deployment. Prefer a code rollback that retains the additive ledger; do not destructively drop production billing history. The old current production deployment is NOT a safe recovery rollback target once recovery locks exist, because it predates lock enforcement. Establish a lock-aware rollback deployment and test it before enabling recovery in Production.
