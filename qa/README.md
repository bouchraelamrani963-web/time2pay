# PR #22: keyless local Firebase QA preparation

Status on 4 November 2026: PREPARED, NOT RUN. Release remains NO-GO.
Base is exactly PR #22 commit d06c89d6e10865c1bf2c3c737be9e392fc616bbe.
This separate QA branch is a harness overlay, not a proposed production authentication change. It does not merge into PR #22 or deploy automatically.

## Observed read-only
- Firebase project time2pay-isolated-qa-20261030, project number 512756616652.
- Spark/no-cost plan retained; Email/Password enabled; users list empty.
- Existing web app time2pay-isolated-qa-web, app ID 1:512756616652:web:a86323add1a508b5b3e169.
- localhost is already authorized; QA firebaseapp.com/web.app are the other listed domains. Real Time2Pay domains are not in that list.
- IAM principals-with-access view shows the owner account with inherited Owner (Legacy), and the QA service account with inherited Service Account Token Creator. It does not show a direct, time-limited Token Creator binding for the owner; effective impersonation has not been tested.
- Existing firebase-adminsdk-fbsvc@time2pay-isolated-qa-20261030.iam.gserviceaccount.com is Enabled, with No keys in Google Cloud's service-account list. No key generated or downloaded.
- Identity Platform shown in Firebase. Console shows SMS MFA Enabled; this does not establish TOTP provider state. No SMS sent. Exact TOTP state/adjacent window must be read via the prepared GET-only preflight.
- No suitable separate Time2Pay QA Neon project was returned by the connector. No production branch was read/copied or reused. Proposed DB is instead an empty, local, ephemeral PostgreSQL container.

## Prepared isolation
- assertIsolatedQa hardcodes the QA Firebase project and rejects production, every hosted Vercel project, mismatched server/client/test project IDs, missing MFA and inherited payment/email/private-key credentials.
- DATABASE_URL and DIRECT_URL must both target localhost/127.0.0.1:55432/time2pay_auth_qa as qa_runner, without query overrides. No remote database is accepted.
- Customer mail and Stripe entry points explicitly reject QA mode. No Stripe or Resend key is accepted. Firebase verification email is the only intended external email and goes only to the separately approved, owner-controlled test address.
- Firebase Admin gets a named QA app and a custom access-token credential. A token expiry longer than one hour, expiry within 30 seconds, missing/expired tokens and all private-key paths are rejected. No automatic credential refresh or fallback.
- The launcher accepts reviewed config via stdin, builds a clean child environment, rejects Next .env files, listens only on 127.0.0.1:3015 and does not deploy to hosting. config.example.json contains placeholders only; never save a completed copy containing secrets.
- compose.yaml binds PostgreSQL to localhost only, uses tmpfs for disposable data and requires an explicit disposable password. Do not import a backup or attach an existing volume.

## Approval gates (none exercised yet)
A. Temporary keyless access: inspect existing IAM first; if necessary request a one-hour expiring Service Account Token Creator binding for the owner's signed-in Google account on ONLY the existing QA service account. Enabling IAM Credentials API in ONLY QA, if needed, is also a separately reviewable authentication configuration change. Do not enable billing, upgrade Spark, create a key, or modify production. Stop if any cost commitment or broader permission is required.
B. QA app/database startup or any hosted QA deployment requires separate approval. Current guard deliberately supports LOCAL ONLY; there is no approved hosted deployment plan. A hosted version needs a separately reviewed database allowlist, identity binding, protection and cost check.
C. Any Firebase provider/domain/TOTP configuration change requires a separate exact proposal and approval after the GET-only configuration result. Do not run scripts/enable-test-totp.cjs; TIME2PAY_CONFIGURE_TEST_TOTP=false remains mandatory.
D. Creating the one test user requires separate approval for the chosen fictitious identity and owner-controlled verification mailbox. Do not use example.invalid for an inbox delivery test. No signup until preflight is green and the owner approves. If any user exists before the authorized signup, stop and identify it; do not create a second user.

## Concrete next action for approval A
Use the existing QA service account above, with a maximum 3600-second impersonated access token held only in process memory. The optional account-level IAM binding expires after one hour. No project-wide Token Creator grant. No refresh token or service-account JSON key is created.
qa/read-provider-with-impersonation.cjs --approved-keyless-access uses the operator's existing gcloud login only to call IAM generateAccessToken for that fixed service account, then invokes qa/preflight.cjs. It prints only project ID, email/password-enabled, TOTP-enabled/adjacentIntervals, whether the users list is empty, and externalConfigurationChanged:false. The script does not alter IAM or enable APIs itself and fails closed if impersonation is unavailable. It has not been executed against Google.

## After A, B, C and D approvals where applicable
1. Confirm Spark still active, exact TOTP provider enabled, existing QA service account has only the intended project privileges, and zero users. Inspect IAM bindings including inherited grants; project-name separation alone does not prove full IAM isolation.
2. Start only the disposable local PostgreSQL container. Apply the reviewed versioned migrations to its exact localhost database; no db push, reset or production migration. Verify empty app tables.
3. Supply public QA web config plus a fresh impersonated token and actual expiry via stdin/in-memory values. Ensure no .env files, production credentials, Stripe/Resend keys or emulator flags are present. Start qa/start.cjs --approved-local-qa only after B. Open http://localhost:3015 on the SAME machine; the user's connected browser cannot reach this agent workspace's localhost.
4. Before signup, request separate D approval. Owner enters the one fictitious account's password herself. Do not log, screenshot or store passwords, tokens, verification URLs/codes, QR seeds, OTPs or recovery codes.
5. Create one account via the real RegisterForm. Before email verification, demonstrate /dashboard redirects/denies and POST /api/auth/session denies email_verification_required without a session cookie. Use that SAME account for every remaining stage.
6. Owner opens the real Firebase verification email and completes the action herself; reload/re-authenticate. Do not set emailVerified manually. Confirm session/dashboard still denied until TOTP is enrolled.
7. Owner scans the real QA QR code and enters her current authenticator code. Finish enrollment and verify that the current ID token proves sign_in_second_factor=totp with a matching enrolled factor. Test wrong/missing TOTP denies access without persisting the OTP.
8. Complete fresh login, server session and dashboard. Check authenticated billing status and invoice entitlement from actual app responses; compare expected end=max(Firebase creationTime+30 days, fixed campaign end) at server time. Do not create a Stripe customer or checkout. Client page text alone is insufficient evidence.
9. Logout. Prove old browser app session no longer opens a protected page. Sign in again with the SAME account and real TOTP, then open dashboard and confirm free access again.
10. Record only sanitized statuses and pass/fail evidence. Re-run relevant tests. Stop the local app and dispose of the local container. Do not delete the Firebase account or change IAM/config without an authorized cleanup action. Let the expiring IAM binding/token lapse; verify expiry. No merge or Time2Pay production deployment.

## Validation
A synthetic-config production build, TypeScript and all runnable local tests passed during preparation. Ten new tests cover project/database/credential isolation, token expiry, unchanged default mode, named Admin initialization, hard-disabled mail/billing, and read-only fixed-project provider preflight. The 11 database tests require an actual PostgreSQL service and are not counted as local passes. PR #22's original head separately passed all 169 tests including its real PostgreSQL tests in CI. Provider/session compatibility of the new keyless path remains unproven until the real QA run.

## Official references checked on 4 November 2026
- https://firebase.google.com/docs/auth/web/totp-mfa — provider state is configured via Admin SDK/config REST; verified email is required before TOTP enrollment.
- https://docs.cloud.google.com/iam/docs/create-short-lived-credentials-direct — service-account impersonation, account-level Token Creator role, tokens without refresh tokens, maximum default lifetime one hour.
- https://firebase.google.com/docs/admin/setup — plain gcloud end-user ADC has Firebase Auth limitations; do not substitute it for the planned QA service-account impersonation.
