const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');

// Execute real route code with isolated auth, billing and storage boundaries.
// All email, PDF and database access throws: a denied request must stop first.
function loadRoute(filename, user, paid) {
  const fail = new Proxy({}, { get() { throw Error('Protected side effect reached'); } });
  const stubs = {
    '@/lib/invoice-issuance': { authorizeInvoiceIssue: async () => null },
    '@/lib/auth': { requireUserOrUnauthorized: async () => user },
    '@/lib/billing': { hasPaidSubscription: async () => paid,
      paymentRequired: () => NextResponse.json({ code: 'SUBSCRIPTION_REQUIRED' }, { status: 402 }) },
    '@/lib/prisma': { prisma: fail },
    '@/lib/invoice-email-content': {}, '@/lib/email': {}, '@/lib/invoice-pdf': {}, '@/lib/calculations': {}, '@/lib/invoice-status': {},
  };
  const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, Response, Request, console, Set,
    require: name => Object.hasOwn(stubs, name) ? stubs[name] : require(name) });
  return module.exports;
}

for (const [route, method] of [
  ['src/app/api/invoices/[id]/send/route.ts', 'POST'],
  ['src/app/api/invoices/[id]/remind/route.ts', 'POST'],
  ['src/app/api/invoices/[id]/pdf/route.ts', 'GET'],
]) {
  test(`${method} ${route}: unsigned-in users get 401 before protected access`, async () => {
    const routeModule = loadRoute(route, new Response(null, { status: 401 }), false);
    const response = await routeModule[method](new Request('https://test.example'), { params: { id: 'test' } });
    assert.equal(response.status, 401);
  });
  test(`${method} ${route}: free users get 402 before email, PDF or database access`, async () => {
    const routeModule = loadRoute(route, { uid: 'free-test-user' }, false);
    const response = await routeModule[method](new Request('https://test.example'), { params: { id: 'test' } });
    assert.equal(response.status, 402);
    assert.equal((await response.json()).code, 'SUBSCRIPTION_REQUIRED');
  });
}

test('checkout retries stay stable, but a new plan or canceled subscription gets a new payment attempt', async () => {
  let previousSubscriptionId = 'sub_canceled_starter';
  const attempts = [];
  const plans = {
    starter: { priceId: 'price_starter', cents: 900 },
    pro: { priceId: 'price_pro', cents: 1900 },
  };
  const stripe = {
    accounts: { retrieveCurrent: async () => ({ id: 'sandbox' }) },
    prices: { retrieve: async id => ({ id, active: true, livemode: false, currency: 'eur',
      unit_amount: Object.values(plans).find(p => p.priceId === id).cents,
      tax_behavior: 'inclusive', recurring: { interval: 'month', interval_count: 1 } }) },
    tax: { registrations: { list: async () => ({ data: [{ country: 'NL', livemode: false }] }) } },
    subscriptions: { list: async () => ({ data: [{ id: previousSubscriptionId, status: 'canceled' }] }) },
    checkout: { sessions: {
      list: async () => ({ data: [] }),
      create: async (body, options) => { attempts.push(options.idempotencyKey); return { url: 'https://checkout.test/session' }; },
    } },
  };
  const stubs = {
    '@/lib/invoice-issuance': { authorizeInvoiceIssue: async () => null },
    '@/lib/auth': { requireUserOrUnauthorized: async () => ({ uid: 'test-user' }) },
    '@/lib/billing': { getStripe: () => stripe, hasPaidSubscription: async () => false, SANDBOX_ACCOUNT: 'sandbox' },
    '@/lib/billing-plans': { BILLING_PLANS: plans, isBillingPlan: key => Object.hasOwn(plans, key) },
    '@/lib/prisma': { prisma: { billingAccount: { createMany: async () => {},
      findUniqueOrThrow: async () => ({ customerId: 'cus_test' }) } } },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/app/api/billing/checkout/route.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, Response, Request, URL, console,
    require: name => Object.hasOwn(stubs, name) ? stubs[name] : require(name) });
  async function checkout(plan) {
    const response = await module.exports.POST(new Request('https://test.example/api/billing/checkout', {
      method: 'POST', headers: { origin: 'https://test.example', 'content-type': 'application/json' }, body: JSON.stringify({ plan }),
    }));
    assert.equal(response.status, 200);
  }
  await checkout('starter');
  await checkout('starter');
  await checkout('pro');
  previousSubscriptionId = 'sub_canceled_pro';
  await checkout('pro');
  assert.equal(attempts[0], attempts[1], 'retries must reuse the same payment attempt');
  assert.notEqual(attempts[1], attempts[2], 'another plan must not reuse the old checkout');
  assert.notEqual(attempts[2], attempts[3], 'resubscribing must not reuse a completed checkout');
});
