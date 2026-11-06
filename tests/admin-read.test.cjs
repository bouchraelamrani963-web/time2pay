const assert = require('node:assert/strict');
const test = require('node:test');
const { loader } = require('./helpdesk-fixture.cjs');

const now = Date.parse('2026-11-06T08:00:00Z');
const links = [{ userId: 'owner-fixture', customerId: 'cus_fixture', subscriptionId: 'sub_fixture' }];
const plans = new Map([['price_fixture', 'starter']]);
const plain = value => JSON.parse(JSON.stringify(value));

const invoice = {
  id: 'in_fixture', livemode: true, customer: 'cus_fixture', currency: 'eur',
  parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_fixture' } },
  lines: { data: [{ pricing: { price_details: { price: 'price_fixture' } } }], has_more: false },
  status: 'open', amount_remaining: 900, amount_paid: 0, due_date: null,
};
function subscription(overrides = {}) {
  return {
    id: 'sub_fixture', customer: 'cus_fixture', livemode: true, latest_invoice: invoice,
    status: 'past_due', ended_at: null, cancel_at: null, cancel_at_period_end: false,
    items: { data: [{ price: { id: 'price_fixture' }, current_period_end: now / 1000 + 86400 }], has_more: false },
    ...overrides,
  };
}
function payment(overrides = {}) {
  return {
    id: 'inpay_fixture', livemode: true, status: 'paid', amount_paid: 900, currency: 'eur',
    // Already November in the Netherlands while UTC is still in October.
    status_transitions: { paid_at: Date.parse('2026-10-31T23:30:00Z') / 1000 },
    payment: { type: 'payment_intent', payment_intent: 'pi_fixture' }, invoice,
    ...overrides,
  };
}
function reader({ subs = [], payments = [], livemode = true } = {}) {
  return {
    livemode, paidAccessEnabled: true, plans,
    stripe: {
      subscriptions: { async *list() { yield* subs; } },
      invoicePayments: { async *list() { yield* payments; } },
    },
  };
}

test('platform role requires the configured Firebase UID and an active support record', async () => {
  const previous = process.env.TIME2PAY_PLATFORM_ADMIN_UID;
  let enabled = true;
  const checked = [];
  const { canUsePlatformAdmin } = loader({
    'react': { cache: fn => fn },
    '@/lib/helpdesk/service': { isSupportAgent: async uid => { checked.push(uid); return enabled; } },
  })('src/lib/admin/access.ts');
  try {
    delete process.env.TIME2PAY_PLATFORM_ADMIN_UID;
    assert.equal(await canUsePlatformAdmin('owner-fixture'), false);
    process.env.TIME2PAY_PLATFORM_ADMIN_UID = 'owner-fixture';
    assert.equal(await canUsePlatformAdmin('other-support-agent'), false);
    assert.deepEqual(checked, []);
    assert.equal(await canUsePlatformAdmin('owner-fixture'), true);
    enabled = false;
    assert.equal(await canUsePlatformAdmin('owner-fixture'), false);
  } finally {
    if (previous === undefined) delete process.env.TIME2PAY_PLATFORM_ADMIN_UID;
    else process.env.TIME2PAY_PLATFORM_ADMIN_UID = previous;
  }
});

test('admin GET denies unauthorized callers before touching the data sources', async () => {
  let session = new Response(null, { status: 401 });
  let reads = 0;
  const { GET, POST } = loader({
    'next/server': { NextResponse: Response },
    '@/lib/auth': { requireUserOrUnauthorized: async () => session },
    '@/lib/admin/access': { canUsePlatformAdmin: async uid => uid === 'owner-fixture' },
    '@/lib/admin/data': {
      parseAdminQuery: input => input.view === 'invalid' ? null : input,
      readAdminData: async () => { reads++; return { checkedAt: 'fixture' }; },
    },
  })('src/app/api/admin/route.ts');
  const url = 'https://time2pay.example/api/admin';
  assert.equal((await GET(new Request(url))).status, 401);
  session = { uid: 'customer-fixture', email: 'owner@example.invalid' };
  assert.equal((await GET(new Request(url))).status, 403);
  session = { uid: 'owner-fixture' };
  assert.equal((await GET(new Request(url + '?view=invalid'))).status, 400);
  assert.equal(reads, 0);
  const response = await GET(new Request(url));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(reads, 1);
  assert.equal(POST, undefined);
});

test('subscription projection uses the linked Stripe customer, mode, and allowlisted price', async () => {
  const { readSubscriptions } = loader()('src/lib/admin/billing-read.ts');
  for (const bad of [{ customer: 'cus_unrelated' }, { livemode: false }, { items: { data: [{ price: { id: 'price_other' } }] } }]) {
    assert.equal((await readSubscriptions(reader({ subs: [subscription(bad)] }), links, now)).size, 0);
  }
  const records = await readSubscriptions(reader({ subs: [subscription()] }), links, now);
  assert.equal(records.get('owner-fixture').summary.status, 'past_due');
  assert.equal(records.get('owner-fixture').summary.invoiceStatus, 'open');
  assert.equal(records.get('owner-fixture').summary.overdueCents, 900);
  assert.equal(records.get('owner-fixture').paidAccess, false);
  assert.doesNotMatch(JSON.stringify([...records.values()]), /cus_fixture|sub_fixture|in_fixture/);
});

test('gross receipts use the Amsterdam paid month and exclude unrelated, duplicate, test and external payments', async () => {
  const { readReceivedPayments } = loader()('src/lib/admin/billing-read.ts');
  const payments = [
    payment(), payment(),
    payment({ id: 'previous', status_transitions: { paid_at: Date.parse('2026-10-31T22:30:00Z') / 1000 } }),
    payment({ id: 'test', livemode: false }),
    payment({ id: 'other-customer', invoice: { ...invoice, customer: 'cus_other' } }),
    payment({ id: 'other-product', invoice: { ...invoice, lines: { ...invoice.lines, data: [] } } }),
    payment({ id: 'external', payment: { type: 'payment_record', payment_record: 'pr_fixture' } }),
  ];
  assert.equal(await readReceivedPayments(reader({ payments }), links, '2026-11'), 900);
  assert.equal(await readReceivedPayments(reader({ payments }), links, '2026-10'), 900);
  assert.equal(await readReceivedPayments(reader({ payments, livemode: false }), links, '2026-11'), null);
  await assert.rejects(readReceivedPayments(reader({ payments: [payment({ currency: 'usd' })] }), links, '2026-11'));
});

test('Firebase pagination, minimal fields, trial policy and partial data on a Stripe outage', async () => {
  const account = (uid, creationTime, overrides = {}) => ({
    uid, email: uid + '@example.invalid', emailVerified: true, disabled: false,
    metadata: { creationTime }, passwordHash: 'hash-fixture', multiFactor: { secret: 'totp-fixture' },
    ...overrides,
  });
  const requests = [];
  const load = loader({
    '@/lib/firebase-admin': { getAdminAuth: () => ({
      listUsers: async (limit, token) => {
        requests.push([limit, token]);
        return token ? { users: [account('disabled-fixture', '2026-10-15T00:00:00Z', { disabled: true })] } :
          { users: [
            account('owner-fixture', '2026-11-05T00:00:00Z'),
            account('trial-fixture', '2026-11-04T00:00:00Z', { emailVerified: false }),
          ], pageToken: 'next' };
      },
    }) },
    '@/lib/prisma': { prisma: {
      billingAccount: { findMany: async () => links },
      supportTicket: { count: async ({ where }) => where.status.not === 'RESOLVED' ? 2 : -1 },
    } },
    '@/lib/registration-trial': { registrationTrialEnabled: () => true },
    '@/lib/billing-environment': { resolveBillingEnvironment: () => { throw new Error('Stripe unavailable'); } },
  });
  const { parseAdminQuery, readAdminData } = load('src/lib/admin/data.ts');
  assert.equal(parseAdminQuery({ month: '2026-12' }, now), null);
  assert.equal(parseAdminQuery({}, now).month, '2026-10');
  const result = plain(await readAdminData(parseAdminQuery({}, now), now));
  assert.deepEqual(requests, [[1000, undefined], [1000, 'next']]);
  assert.equal(result.overview.registered, 3);
  assert.equal(result.overview.active, 1);
  assert.equal(result.overview.tickets, 2);
  assert.equal(result.overview.trials, null);
  assert.equal(result.overview.subscriptions, null);
  assert.equal(result.overview.recent[0].billingKnown, false);
  assert.equal(result.overview.recent[1].trialEndsAt, '2026-12-04T00:00:00.000Z');
  assert.equal(result.overview.recent[2].trialEndsAt, null);
  assert.equal(result.reports.revenueCents, null);
  assert.deepEqual(result.reports.growth.at(-1), { month: '2026-10', registrations: 1 });
  assert.doesNotMatch(JSON.stringify(result), /"uid"|passwordHash|hash-fixture|totp-fixture|cus_fixture|sub_fixture/);
});
