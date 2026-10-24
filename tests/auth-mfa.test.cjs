const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');

function load(file, stubs = {}, env = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports,
    process: { env }, Date, Number, Boolean, URL, Response, console: { error() {} },
    require: name => Object.hasOwn(stubs, name) ? stubs[name] : require(name),
  });
  return module.exports;
}
const policyFile = 'src/lib/auth-policy.ts';
const policy = load(policyFile);
const first = { email_verified: true, firebase: { sign_in_provider: 'password' } };
const second = { email_verified: true, firebase: { sign_in_provider: 'password', sign_in_second_factor: 'totp', second_factor_identifier: 'totp-test' } };
const enrolled = { disabled: false, multiFactor: { enrolledFactors: [{ factorId: 'totp', uid: 'totp-test' }] } };
const plain = { disabled: false };

test('an enrolled account cannot use a password-only token, even before global enforcement', () => {
  assert.equal(policy.mfaAccessError(first, enrolled, false), 'mfa_required');
  assert.equal(policy.mfaAccessError(second, enrolled, false), null);
});
test('mandatory TOTP blocks unenrolled, unverified, disabled and other-factor accounts', () => {
  assert.equal(policy.mfaAccessError(first, plain, true), 'mfa_setup_required');
  assert.equal(policy.mfaAccessError({ ...second, email_verified: false }, enrolled, true), 'email_verification_required');
  assert.equal(policy.mfaAccessError(second, { ...enrolled, disabled: true }, true), 'account_disabled');
  assert.equal(policy.mfaAccessError({ ...second, firebase: { sign_in_second_factor: 'phone' } }, enrolled, true), 'mfa_required');
  assert.equal(policy.mfaAccessError(second, plain, true), 'mfa_setup_required');
  assert.equal(policy.mfaAccessError(first, plain, false), null);
});
test('preview enrollment stays off without explicit isolated auth project matching both SDKs', () => {
  const base = { TIME2PAY_TOTP_SETUP_ENABLED: 'true', VERCEL_ENV: 'preview', FIREBASE_PROJECT_ID: 'live', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'live' };
  assert.equal(load(policyFile, {}, base).getMfaConfiguration().setupEnabled, false);
  assert.equal(load(policyFile, {}, { ...base, TIME2PAY_TOTP_TEST_PROJECT_ID: 'test' }).getMfaConfiguration().setupEnabled, false);
  assert.equal(load(policyFile, {}, { ...base, FIREBASE_PROJECT_ID: 'time2pay-c5c5c', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'time2pay-c5c5c', TIME2PAY_TOTP_TEST_PROJECT_ID: 'time2pay-c5c5c' }).getMfaConfiguration().setupEnabled, false);
  const isolated = { ...base, FIREBASE_PROJECT_ID: 'test', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test', TIME2PAY_TOTP_TEST_PROJECT_ID: 'test' };
  assert.equal(load(policyFile, {}, isolated).getMfaConfiguration().setupEnabled, true);
  assert.equal(load(policyFile, {}, { ...isolated, TIME2PAY_TOTP_SETUP_ENABLED: 'false' }).getMfaConfiguration().setupEnabled, false);
});
test('only recent sign-ins may create sessions, with a bounded clock tolerance', () => {
  assert.equal(policy.isRecentSignIn(700, 1000), true);
  assert.equal(policy.isRecentSignIn(699, 1000), false);
  assert.equal(policy.isRecentSignIn(1031, 1000), false);
  assert.equal(policy.isRecentSignIn(NaN, 1000), false);
});
test('return destinations stay inside the app', () => {
  const { safeNextPath } = load('src/lib/auth-navigation.ts');
  for (const unsafe of [null, 'https://evil.example', '//evil.example', '/\\evil.example', '/\nevil.example']) assert.equal(safeNextPath(unsafe), '/dashboard');
  assert.equal(safeNextPath('/invoices?status=draft'), '/invoices?status=draft');
});

function fixture({ token = first, account = enrolled, required = false, revoked = false } = {}) {
  let created = 0;
  const setCookies = [];
  const admin = {
    verifyIdToken: async (value, checkRevoked) => {
      assert.equal(value, 'signed-token'); assert.equal(checkRevoked, true);
      if (revoked) throw Error('revoked');
      return { uid: 'user-test', auth_time: Date.now() / 1000, ...token };
    },
    getUser: async uid => { assert.equal(uid, 'user-test'); return account; },
    createSessionCookie: async () => { created++; return 'signed-session'; },
    verifySessionCookie: async (value, checkRevoked) => {
      assert.equal(checkRevoked, true);
      return { uid: 'user-test', email: 'test@example.com', ...token };
    },
  };
  const env = { TIME2PAY_REQUIRE_TOTP: String(required) };
  const actualPolicy = load(policyFile, {}, env);
  const stubs = {
    '@/lib/account-recovery': { RecoveryError: class extends Error {}, exchangeRecoverySession: async () => ({}), recoveryLocked: async () => false, deliverSecurityNotices: async () => {} },
    './account-recovery': { recoveryLocked: async () => false },
    '@/lib/recovery-config': { RECOVERY_COOKIE: '__Host-time2pay_recovery', recoveryEnabled: () => false },
    'server-only': {}, 'next/server': { NextResponse },
    'next/headers': { cookies: () => ({ get: () => ({ value: 'signed-session' }), set: (...args) => setCookies.push(args) }) },
    'next/navigation': { redirect: () => { throw Error('redirect'); } },
    '@/lib/firebase-admin': { getAdminAuth: () => admin, getMissingFirebaseAdminEnv: () => [] },
    './firebase-admin': { getAdminAuth: () => admin },
    '@/lib/auth-policy': actualPolicy, './auth-policy': actualPolicy,
    '@/lib/auth': { SESSION_COOKIE: '__time2pay_session', SESSION_MAX_AGE_DAYS: 5 },
  };
  return {
    route: load('src/app/api/auth/session/route.ts', stubs, env),
    session: load('src/lib/auth.ts', stubs, env),
    created: () => created, setCookies,
  };
}
function request(body = { idToken: 'signed-token' }, origin = 'https://test.example') {
  return new Request('https://test.example/api/auth/session', { method: 'POST',
    headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
for (const options of [
  { token: first, account: enrolled },
  { token: first, account: plain, required: true },
  { token: { ...second, email_verified: false }, account: enrolled },
  { token: second, account: { ...enrolled, disabled: true } },
  { token: second, account: enrolled, revoked: true },
]) {
  test(`session exchange rejects unsafe auth: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    const response = await f.route.POST(request({ idToken: 'signed-token', mfaVerified: true, code: '123456' }));
    assert.ok([401, 403].includes(response.status));
    assert.equal(f.created(), 0); assert.equal(f.setCookies.length, 0);
  });
}
test('valid verified TOTP token creates a secure HTTP-only session', async () => {
  const f = fixture({ token: second, required: true });
  assert.equal((await f.route.POST(request())).status, 200);
  assert.equal(f.created(), 1);
  assert.equal(f.setCookies[0][2].httpOnly, true);
  assert.equal(f.setCookies[0][2].sameSite, 'lax');
});
test('cross-origin exchange is denied before any cookie is created', async () => {
  const f = fixture({ token: second });
  assert.equal((await f.route.POST(request(undefined, 'https://evil.example'))).status, 403);
  assert.equal(f.created(), 0);
});
test('already-issued password-only cookies lose access once MFA is enrolled or required', async () => {
  assert.equal(await fixture({ token: first }).session.getSession(), null);
  assert.equal(await fixture({ token: first, account: plain, required: true }).session.getSession(), null);
  assert.equal((await fixture({ token: second }).session.getSession()).uid, 'user-test');
  assert.equal((await fixture({ token: first, account: plain }).session.getSession()).uid, 'user-test');
});

function adminFixture(env, apps = []) {
  const credentials = [];
  const module = load('src/lib/firebase-admin.ts', {
    'server-only': {},
    'firebase-admin/app': { getApps: () => apps, cert: value => { credentials.push(value); return value; }, initializeApp: (config, name) => ({ config, name }) },
    'firebase-admin/auth': { getAuth: app => app },
  }, env);
  return { module, credentials };
}
const testEnv = { VERCEL_ENV: 'preview', TIME2PAY_TOTP_TEST_PROJECT_ID: 'time2pay-preview', FIREBASE_PROJECT_ID: 'time2pay-preview', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'time2pay-preview', FIREBASE_CLIENT_EMAIL: 'production@example.com', FIREBASE_PRIVATE_KEY: 'production-key-never-used' };
const fakeCredential = { project_id: 'time2pay-preview', client_email: 'test@time2pay-preview.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----test-only' };
test('isolated auth never falls back to inherited production credentials or a default Firebase app', () => {
  const f = adminFixture(testEnv, [{ name: '[DEFAULT]' }]);
  assert.equal(f.module.getMissingFirebaseAdminEnv()[0], 'FIREBASE_TEST_SERVICE_ACCOUNT_JSON');
  assert.throws(() => f.module.getAdminAuth());
  assert.equal(f.credentials.length, 0);
});
test('isolated auth rejects mismatched project credentials and production activation', () => {
  for (const env of [
    { ...testEnv, FIREBASE_TEST_SERVICE_ACCOUNT_JSON: JSON.stringify({ ...fakeCredential, project_id: 'time2pay-c5c5c' }) },
    { ...testEnv, VERCEL_ENV: 'production', FIREBASE_TEST_SERVICE_ACCOUNT_JSON: JSON.stringify(fakeCredential) },
    { ...testEnv, FIREBASE_TEST_SERVICE_ACCOUNT_JSON: 'invalid-json' },
  ]) {
    const f = adminFixture(env);
    assert.throws(() => f.module.getAdminAuth());
    assert.equal(f.credentials.length, 0);
  }
});
test('isolated auth uses its own named Firebase app and test credential', () => {
  const f = adminFixture({ ...testEnv, FIREBASE_TEST_SERVICE_ACCOUNT_JSON: JSON.stringify(fakeCredential) }, [{ name: '[DEFAULT]' }]);
  assert.equal(f.module.getAdminAuth().name, 'time2pay-isolated-test');
  assert.equal(f.credentials[0].project_id, 'time2pay-preview');
});
