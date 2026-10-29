# Billing webhook recovery — isolated development preparation

Date: 29 October 2026. Reviewed source: Preview snapshot
`50dabd49d794557c61d503b2184046e6b09f32ae`.
Scope: the owner approved the source repair, then the additive migration on the
existing isolated Preview database, then pushing/deploying only to the existing
Preview branch. No Stripe configuration, payment or production change is authorized.
The migration was applied successfully on 29 October 2026; all twelve existing
tables retained matching row counts and content digests. The execution status of
deployment and remaining practice tests is tracked in the publication plan.

## Event contract

Keep `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
After separately approving and deploying/testing this handler, add only:

- `invoice.payment_failed`
- `invoice.paid`
- `customer.subscription.updated`
- `customer.subscription.deleted`

The raw-body signature, mode and configured account checks remain mandatory.
Invoice ownership follows `parent.subscription_details.subscription` on the
reviewed Stripe API version; metadata does not create lifecycle ownership.
Customer mapping must already exist in the application database. Lifecycle events
with a known customer but pending trusted Checkout mapping remain retryable.
Unmapped Dashboard customers are ignored rather than assigned to an application user.

Receipts use a composite account/event key. The customer transaction lock serializes
concurrent events; notification keys additionally coalesce different event IDs for
the same invoice/outcome. No raw payload or payment credentials are stored.
Current Stripe subscription and invoice state is read inside processing; event
timestamps do not establish ordering. Protected invoice actions still fetch current
Stripe state on every request, never granting access from these event receipts.

## Access and customer communication

`past_due` does not grant paid access. A still-valid registration/launch free period
continues to grant access independently. Once the free period expires, sending,
definitive PDF, reminders and printing through the protected PDF are denied.
Drafts and customer data remain stored. A confirmed, current paid active subscription
restores paid access and the existing plan limit, without resetting invoice usage.

The billing page distinguishes payment failure, cancellation and valid free access.
It does not claim automatic payments stop when an existing unpaid subscription can retry.

Billing notices are a separate durable outbox. Preview uses the existing test-only
email configuration and `delivered@resend.dev`; it never emails real customers.
The verified Firebase identity, current mapping, price, invoice and status are
checked again before transport. Superseded notices are suppressed. Provider
idempotency, send leases and the existing bounded retry policy prevent duplicate
messages. A Workflow sleeps until the retry time. The authenticated existing cron
sweep recovers interrupted dispatch. Provider acceptance is not proof of inbox delivery.

`TIME2PAY_BILLING_NOTICES_ENABLED=true` would enable dispatch. No environment flag
has been changed. Outbox creation requires the migration even with dispatch disabled.

## Validation performed locally

- 155 automated tests: 144 passed, zero failed, 11 skipped for unavailable real PostgreSQL.
- 26 new billing lifecycle/notification tests use isolated storage, Stripe, Firebase
  and email boundaries; they do not constitute an authenticated Preview practice test.
- Existing HTTP signature tests use Stripe SDK signatures, including wrong secret,
  tampering, wrong mode/account, and unallowlisted price rejection.
- TypeScript and the optimized Next.js build passed; two Workflow definitions compiled.
- HTTP security headers passed on login, forgot-password, recovery and session routes.
- Dependency audit reported zero vulnerabilities on this execution (29 October 2026).
- Prisma schema validation passed using a deliberately unreachable localhost URL;
  no database migration was applied.
- CI migration rehearsal was updated to include the new additive SQL migration.
  This changed CI workflow has not been pushed or executed remotely.

## Separately approved next steps, in order

1. Verify the isolated Preview database identity, then obtain approval to apply only
   `20261029100000_billing_webhook_notices` there. Preserve all existing data.
2. Obtain approval for pushing/deploying this code only to the existing isolated Preview
   (branch deployment may occur automatically on push). Never deploy an unconfigured new branch.
3. Obtain approval to enable Preview billing notice dispatch, then configure the four
   additional events on existing sandbox endpoint `we_1UTNzpITnweMFGCg0lUasbPD`.
   Preserve its URL, signing secret, existing events and original sandbox account.
4. Obtain approval for a narrowly scoped mapping of the EXISTING Stripe test customer
   `cus_VWm5dNY5sFrPDE` / subscription `sub_1UVijgITnweMFGCguDjEk6z7` to an EXISTING
   authenticated Preview test account. Confirm it has no conflicting billing mapping.
   Do not modify Firebase identity, registration dates, factors or recovery data.
5. With owner login when needed, verify actual failed-payment access, valid free access,
   expired free access, invoice actions, UI and test-only notification/retries.
   Stripe test clocks do not move Firebase registration dates or the application clock.
   An actual expired-access browser probe remains pending until a safe fixture is agreed.
6. Obtain separate approval to replay existing sandbox events and for a recovery test
   payment using the existing customer/subscription/invoice; verify HTTP delivery,
   outbox coalescing, current status and restored access. Create no duplicates.

Production remains blocked. Broader production readiness also needs risk-side
handling/reconciliation for refunds, disputes and early fraud warnings; this focused
repair does not claim those checks or Pro/Business practice tests are complete.
Tax, catalog, API keys, OAuth Read scope and production payment activation are unchanged.
