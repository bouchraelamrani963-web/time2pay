# Production billing preparation

This change prepares a separate configuration path. It does not enable live
payments, change any hosting settings, or approve a release. Existing Preview
continues to use its sandbox account, restricted test key and three test prices.

## Separate production settings

Configure server-side variables only in Production, after validating the correct
business account and its verification requirements:

- `TIME2PAY_BILLING_MODE=live`
- `STRIPE_LIVE_ACCOUNT_ID`
- `STRIPE_LIVE_RESTRICTED_KEY` (restricted live key)
- `STRIPE_LIVE_WEBHOOK_SECRET`
- `STRIPE_LIVE_STARTER_PRICE_ID`
- `STRIPE_LIVE_PRO_PRICE_ID`
- `STRIPE_LIVE_BUSINESS_PRICE_ID`

Never copy test keys, signing secrets or price IDs. Live price IDs must be unique
and distinct from the sandbox allowlist. Checkout independently reads the actual
Stripe account, price and tax registration: active EUR 9/19/39, monthly interval
count one, inclusive tax behavior and the correct environment. An active Dutch
tax registration is a configuration check, not an assessment of tax obligations.

The production endpoints accept only HTTPS origins `time2pay.nl` and
`www.time2pay.nl`. Request Origin must match the endpoint's own origin. The portal
checks the selected account before creating a portal session. Webhooks verify
the raw payload with the environment-specific signing secret, check account and
mode, and require the existing authenticated customer/owner mapping and an
allowlisted subscription price. Access always re-reads the subscription and paid
invoice. Starter uses its environment's price ID for its 30-invoice period limit.

## Separate activation decision

Leave `TIME2PAY_LIVE_PAYMENTS_ENABLED` unset or `false`. Configuring live
credentials does not grant permission to accept live payments. Checkout, portal,
webhook processing and live paid access remain blocked until this flag is exactly
`true`. Set it only after final production validation and the owner's separate,
explicit approval to activate real payments. A public release approval alone is
not that approval. Disabling this flag also disables paid operations; plan a
maintenance response before using it once real customers exist.

`resolveBillingEnvironment(env, false)` permits read-only configuration
inspection without activation. It returns secret-bearing configuration to trusted
server code; never log or expose the returned object or its keys. It does not
contact Stripe and cannot prove account verification, webhook delivery, product
settings, email delivery, backup quality or successful payments.

## Release conditions still required

Before publication, validate live account ownership and verification, actual live
prices and tax policy, signing-secret provisioning and webhook delivery. Complete
renewal/failure/cancellation and Starter boundary practice tests in isolation.
Retain existing customer and invoice ownership, rehearse versioned migrations on
an isolated copy, and verify a protected backup and a recovery-lock-aware rollback.
Authentication/recovery production readiness is a separate release gate. Do not
promote a Preview deployment with test Firebase settings baked into its bundle.

Automated tests use synthetic configuration, stub external account/storage calls,
and use the real Stripe SDK to verify webhook signatures. They do not use live
credentials or make live payments. A new Preview acceptance run is required after
this change; earlier browser results apply to the preceding sandbox version.
