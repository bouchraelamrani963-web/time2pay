# Release dependency review — 1 November 2026

Base: b4cee7dbecdb0ba7fd5b2d16bfae1a91f4efef02. No production credentials or data were used.

## Original dependency chains

| Chain from direct dependency | Original affected version | Use and reachability |
| --- | --- | --- |
| firebase-admin 14.5.0 → @google-cloud/firestore 9.4.0 → @google-cloud/firestore-api 0.2.0 → google-gax 5.0.8 → rimraf 5.0.10 → glob → minimatch | glob 10.5.0; minimatch 9.0.9 | Installed as runtime dependencies, but the application imports Firebase Auth, not Firestore. No direct glob/rimraf usage found in this gax runtime source or application routes. |
| workflow 5.2.3 → @workflow/cli 5.0.6 → @oclif/core 4.11.4 → minimatch | 10.2.6 | CLI/plugin workspace discovery, not a Time2Pay request input. |
| workflow 5.2.3 → @workflow/cli 5.0.6 → @oclif/core 4.11.4 → ejs 3.1.10 → jake 10.9.4 → filelist 1.0.6 → minimatch | 5.1.9 | CLI/build file matching. |
| workflow 5.2.3 → @workflow/cli 5.0.6 → @workflow/world-local 5.1.2 → @vercel/queue 0.8.0 → minimatch | 10.2.6 | Local queue dev-route matching uses developer-controlled vercel.json paths. |
| workflow 5.2.3 → @workflow/nest 5.1.4 → @swc/cli 0.8.1 → minimatch | 9.0.9 | Compiler CLI file matching; this application uses Next.js, not Nest. |

The original npm audit reported 28 moderate affected packages through propagation of two advisories, not 28 independent root vulnerabilities:

- GHSA-3g3m-2fjr-6pw4: glob abort cancellation can leave traversal running; patched in 14.0.2.
- GHSA-g3hv-75wg-m249: minimatch pattern amplification can consume excessive resources; patched in 11.0.1.

Do not label all findings development-only: production dependency metadata includes them, and matching-function code is bundled into original server chunks. No application HTTP input path to attacker-controlled glob patterns was identified. Bundle presence alone does not prove exploitability; absence from Next file traces alone does not prove absence from bundles.

## Minimal repair

Pin transitive overrides to glob 14.0.2 and minimatch 11.0.1. Direct Next, Firebase, Workflow and Stripe versions stay unchanged. These cross major transitive boundaries, so real FileList and rimraf glob compatibility tests supplement the existing suite and full production-mode build.

The TOTP setup script now requires an explicit VERCEL_ENV=preview and matching server/client/isolated project IDs before loading Firebase Admin. The known production project is always rejected. With the setup flag disabled, Firebase Admin is not loaded by the script. Production context with setup enabled fails before Admin access. All guard tests use synthetic stubs.

Only this security branch has automatic Vercel deployment disabled in vercel.json. The branch is created directly at the complete repaired commit so its initial remote state already contains that rule. No PR, deployment or production configuration change is part of this work.

## Validation and release limits

- Updated lockfile audit: zero vulnerabilities.
- Synthetic automated suite: 152 passed, zero failed, 11 skipped (real PostgreSQL fixtures unavailable).
- Two cross-major dependency-interface tests and six TOTP build-guard tests included.
- TypeScript and isolated production-mode build checked separately; build uses synthetic Firebase settings, an unreachable localhost database and TIME2PAY_LIVE_PAYMENTS_ENABLED=false.
- No real Firebase/Stripe/mail operations and no migrations.

Vercel production DATABASE_URL and DIRECT_URL remain sensitive and unreadable through the available connector. Their host/branch mapping cannot be independently certified from metadata alone. The production live-payment flag remains false. The local encrypted backup still requires a complete local restore rehearsal. This branch is not a deployment approval and its synthetic build must not be published.
