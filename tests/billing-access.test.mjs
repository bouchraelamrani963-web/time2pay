import test from 'node:test';
import assert from 'node:assert/strict';
import { BILLING_PLANS, grantsPaidAccess, isBillingPlan } from '../src/lib/billing-plans.ts';
const now = Date.parse('2026-10-22T14:00:00Z');
const valid = { livemode: false, status: 'active', invoicePaid: true,
  priceId: BILLING_PLANS.starter.priceId, periodEnd: now / 1000 + 3600 };

test('only three allowlisted plans, no inherited object properties', () => {
  assert.equal(isBillingPlan('starter'), true);
  for (const plan of ['toString', '__proto__', '', null, {}, 'enterprise']) assert.equal(isBillingPlan(plan), false);
});
test('every configured paid test plan grants access', () => {
  for (const plan of Object.values(BILLING_PLANS)) assert.equal(grantsPaidAccess({ ...valid, priceId: plan.priceId }, now), true);
});
test('a redirect or unfinished initial payment never grants access', () => {
  assert.equal(grantsPaidAccess({ ...valid, invoicePaid: false }, now), false);
});
test('trials, pending payments, failed renewals and cancellations are denied', () => {
  for (const status of ['trialing', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused', 'canceled']) {
    assert.equal(grantsPaidAccess({ ...valid, status }, now), false, status);
  }
});
test('live subscriptions and unknown price IDs are denied', () => {
  assert.equal(grantsPaidAccess({ ...valid, livemode: true }, now), false);
  assert.equal(grantsPaidAccess({ ...valid, priceId: 'price_untrusted' }, now), false);
});
test('expired periods and exact expiry boundary are denied', () => {
  for (const periodEnd of [now / 1000, now / 1000 - 1, 0]) assert.equal(grantsPaidAccess({ ...valid, periodEnd }, now), false);
});
