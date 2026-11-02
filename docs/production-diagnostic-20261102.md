# Production diagnostic — reviewed preparation, 2 November 2026

Base release: 2244dad88831e95f1e6ff47c51b7569bf4bc0be9.
Branch: diagnostics/time2pay-prod-readonly-20261102. Automatic Git deployment remains disabled in vercel.json. No application route, cron, build hook or dependency was added.

## Safety contract

- Standalone CLI only, with VERCEL_ENV=production AND TIME2PAY_DIAGNOSTIC_APPROVED=true. The latter is process-local, never a persistent variable.
- TIME2PAY_LIVE_PAYMENTS_ENABLED must equal false before any SDK loads.
- Both database URLs must match the independently verified production endpoint and neondb, use port 5432/default, sslmode=require AND sslaccept=strict. Reject duplicate parameters and unrecognized options; never silently repair TLS settings. A production URL missing strict verification returns FAIL without connecting. TLS certificates themselves are verified by Prisma, not by the offline tests.
- In-memory connection settings bound connect/pool/socket waits to 5 seconds and pool size to one. The original production environment is not changed. Only SELECT current_database() is issued; no user rows, migration or writes.
- Firebase identity must match time2pay-c5c5c; no test credentials. Only projectConfigManager().getProjectConfig() is called. No user API, provider changes or new credentials. Firebase HTTP timeout: 5 seconds.
- Each remote wait is bounded to 5 seconds; each cleanup wait to 1 second. CLI has a 20-second wall-clock watchdog and exits after output to terminate remaining SDK work. Promise timeout alone does not cancel an underlying request. An external supervisor must also enforce the 20-second deadline (including a blocked event loop).
- Refuse TLS bypass, emulator, ambient Google credential-file override and proxy environment settings.
- CLI suppresses ordinary SDK stdout/stderr and emits only fixed check names and PASS/FAIL/UNKNOWN/NOT_RUN. Raw errors, configuration and query rows never enter the report. This does not sandbox malicious native code or direct OS file-descriptor writes; use reviewed installed dependencies and a trusted supervisor. Do not enable debug traces, core dumps, shell tracing or environment logging. Do not import CLI into a shared web process: stream suppression/process.exit are intentionally standalone.
- SDKs may obtain ordinary short-lived access tokens from existing credentials; no new keys, service accounts or persistent credentials are created. Reads may generate provider audit logs.

## Actual offline verification

14 tests passed, zero failed/skipped under Node 24.22.1, in a separate temporary directory, with empty inherited environment and Node filesystem/process permission restrictions. No production credentials, external SDK installations or remote calls. OS network namespaces were unavailable. Added mock tests cover exact SQL, URL options, one project-config read, cleanup, mismatches, SDK errors, hanging calls/cleanup, noisy output and total watchdog. These are offline contract tests, not validation of the installed production SDKs, certificates or live configuration.

## One execution design: provider-attested execution in the existing active deployment

Status: BLOCKED with currently available capabilities. This is a design with prerequisites, not a claim that Vercel offers an exec API.

1. Using the existing authorized Vercel control plane, resolve time2pay.nl and www.time2pay.nl to the same active deployment ID, project/team and Git SHA immediately before execution. Independently resolve the Neon endpoint to time2pay-db / production / neondb.
2. Require an already-existing, provider-supported authenticated administration channel capable of starting a standalone child diagnostic within that exact deployment's function environment, without rebuilding, attaching a new endpoint, changing code/configuration, or exporting secrets. Vercel must attest the deployment identity outside self-declared process environment. A generic Sandbox session is not that environment.
3. The trusted supervisor uses the active function's actual database and Firebase configuration (including build-time public Firebase project identity), not current project defaults, copied Preview settings, or values manually labeled production. Verify the reviewed diagnostic content by SHA-256 before execution; use existing installed SDKs only. If in-place ephemeral execution cannot be provided without mutation, STOP; no fallback deployment.
4. After separate user approval, run exactly once with process-local approval, payments remaining false, no tracing, and an external 20-second kill deadline. Use existing credentials only. The child may contact only the verified Neon endpoint and required Google authentication/project-config services. Capture only the fixed status report plus non-secret deployment ID/Git SHA/script digest and UTC execution time from the trusted supervisor. Do not export an environment dump or secret-derived hashes.
5. Re-read both domain mappings afterwards. If deployment identity changed, attribution is UNKNOWN and the result is not accepted as production evidence. Even an all-PASS report proves only the checked configuration/read operations, not complete application behavior or schema readiness.

Why local env pull is insufficient: sensitive values are not returned by the current connector, current project variables need not equal an older deployment's snapshot, and setting VERCEL_ENV does not establish provenance. Neither a new staged deployment nor a standalone sandbox proves the existing public artifact.

No such attested existing-deployment execution channel is available in this session. Consequently the requested end-to-end production evidence cannot currently be obtained under the no-deployment/no-production-change constraints. Do not bypass this restriction or ask for credentials in chat.

## Separate execution approval (only after prerequisites are established)

Authorize exactly one read-only diagnostic run in the provider-attested active deployment identified at execution time, using existing credentials; only SELECT current_database() and Firebase getProjectConfig(), fixed sanitized output, process-local approval and a 20-second supervisor deadline. No code/configuration persistence, deployment, migration, account/provider changes, payment activation, new credentials or customer-data access. If attested execution is unavailable, stop and report BLOCKED; approval does not authorize a substitute environment.

No execution, provider-support message, credential access, deployment, merge or migration is authorized by preparation alone. Release 2244dad remains NO-GO: production schema migration and other release gates remain separate.
