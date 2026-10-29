const test = require('node:test'), assert = require('node:assert/strict');
const { checkEnvironment, totp } = require('../scripts/check-preview-password-reset.cjs');
const valid = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'codex/time2pay-stripe-test',
  FIREBASE_PROJECT_ID: 'time2pay-preview', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'time2pay-preview',
  TIME2PAY_TOTP_TEST_PROJECT_ID: 'time2pay-preview', NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'time2pay-preview.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'synthetic-public-key', NEXT_PUBLIC_FIREBASE_APP_ID: 'synthetic-app-id',
  FIREBASE_TEST_SERVICE_ACCOUNT_JSON: JSON.stringify({project_id:'time2pay-preview',
    client_email:'synthetic@time2pay-preview.iam.gserviceaccount.com', private_key:'-----BEGIN PRIVATE KEY-----synthetic-only'}) };
test('integration rehearsal rejects Production and every mismatched isolation marker before SDK initialization', () => {
  assert.equal(checkEnvironment(valid).project_id, 'time2pay-preview');
  for (const changes of [{VERCEL_ENV:'production'}, {VERCEL_GIT_COMMIT_REF:'main'},
    {FIREBASE_PROJECT_ID:'time2pay-c5c5c'}, {NEXT_PUBLIC_FIREBASE_PROJECT_ID:'time2pay-c5c5c'},
    {TIME2PAY_TOTP_TEST_PROJECT_ID:'time2pay-c5c5c'}, {NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:'time2pay-c5c5c.firebaseapp.com'},
    {FIREBASE_TEST_SERVICE_ACCOUNT_JSON:'{}'}, {FIREBASE_TEST_SERVICE_ACCOUNT_JSON:'invalid'}]) {
    assert.throws(() => checkEnvironment({...valid, ...changes}));
  }
});
test('test-only TOTP calculation matches the public RFC 6238 SHA-1 vector', () => {
  assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000), '287082');
});
