const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
function load(file, stubs = {}, env = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, process: { env }, URL,
    require: name => Object.hasOwn(stubs, name) ? stubs[name] : require(name),
  });
  return module.exports;
}
const policy = load('src/lib/password-reset-policy.ts');
const production = { VERCEL_ENV: 'production', FIREBASE_PROJECT_ID: 'time2pay-c5c5c', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'time2pay-c5c5c' };
const preview = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'codex/time2pay-stripe-test', TIME2PAY_TOTP_TEST_PROJECT_ID: 'time2pay-preview',
  FIREBASE_PROJECT_ID: 'time2pay-preview', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'time2pay-preview' };
test('password reset is unavailable to inherited Production settings in Preview or mismatched projects', () => {
  assert.equal(policy.passwordResetAvailable(production), true);
  assert.equal(policy.passwordResetAvailable(preview), true);
  for (const env of [{}, { ...production, VERCEL_ENV: 'preview' }, { ...preview, VERCEL_GIT_COMMIT_REF: 'another-branch' },
    { ...preview, NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'time2pay-c5c5c' }, { ...production, NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'time2pay-preview' },
    { ...production, TIME2PAY_TOTP_TEST_PROJECT_ID: 'time2pay-preview' }, { ...production, FIREBASE_TEST_SERVICE_ACCOUNT_JSON: '{}' }]) {
    assert.equal(policy.passwordResetAvailable(env), false);
  }
});
function nodes(root) {
  if (Array.isArray(root)) return root.flatMap(nodes);
  if (!root || typeof root !== 'object') return [];
  return [root, ...nodes(root.props?.children)];
}
function text(root) {
  if (Array.isArray(root)) return root.map(text).join(' ');
  if (root && typeof root === 'object') return text(root.props?.children);
  return typeof root === 'string' ? root : '';
}
function fixture(send) {
  const state = [], refs = []; let index = 0, refIndex = 0;
  const auth = { name: 'existing-firebase-auth' }, calls = [];
  const react = { useState(initial) { const at = index++; if (!(at in state)) state[at] = initial;
    return [state[at], value => { state[at] = value; }]; },
    useRef(initial) { const at = refIndex++; return refs[at] ||= { current: initial }; } };
  const Form = load('src/components/PasswordResetForm.tsx', {
    react, 'next/link': { default: 'a' }, '@/lib/password-reset-policy': policy,
    '@/lib/firebase-client': { getFirebaseAuth: () => auth },
    'firebase/auth': { sendPasswordResetEmail: async (...args) => { calls.push(args); return send(...args); } },
  }).default;
  const render = () => { index = 0; refIndex = 0; return Form(); };
  function enter(email) { nodes(render()).find(n => n.type === 'input').props.onChange({ target: { value: email } }); }
  const submit = () => nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  return { render, enter, submit, calls, auth };
}
test('reset submits only a trimmed email to the existing Firebase instance and shows a neutral response', async () => {
  const f = fixture(async () => {}); f.enter('  synthetic@example.invalid  '); await f.submit();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0][0], f.auth);
  assert.equal(f.calls[0][1], 'synthetic@example.invalid'); assert.equal(f.calls[0].length, 2);
  const view = f.render(); assert.equal(nodes(view).find(n => n.props?.role === 'status').props.children, policy.PASSWORD_RESET_NOTICE);
  assert.equal(nodes(view).some(n => n.type === 'form'), false);
  assert.ok(text(view).includes('aparte herstelprocedure'));
  assert.ok(nodes(view).some(n => n.props?.href === '/login'));
});
test('unknown emails receive the same response without account enumeration', async () => {
  const f = fixture(async () => { throw { code: 'auth/user-not-found', message: 'private provider message' }; });
  f.enter('unregistered@example.invalid'); await f.submit();
  assert.equal(nodes(f.render()).find(n => n.props?.role === 'status').props.children, policy.PASSWORD_RESET_NOTICE);
  assert.equal(nodes(f.render()).some(n => n.props?.role === 'alert'), false);
});
test('rapid double submission issues only one Firebase request', async () => {
  let finish; const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture(() => pending); f.enter('synthetic@example.invalid');
  const first = f.submit(), second = f.submit();
  assert.equal(f.calls.length, 1); assert.equal(nodes(f.render()).find(n => n.type === 'button').props.disabled, true);
  finish(); await Promise.all([first, second]);
});
for (const code of ['auth/network-request-failed', 'auth/too-many-requests', 'auth/invalid-email', 'unexpected-private-code']) {
  test(`reset handles ${code} without exposing provider details or issuing a session`, async () => {
    const f = fixture(async () => { throw { code, message: 'private provider message' }; });
    f.enter('synthetic@example.invalid'); await f.submit();
    const view = f.render(); assert.ok(nodes(view).some(n => n.props?.role === 'alert'));
    assert.ok(!text(view).includes('private provider message'));
    assert.equal(nodes(view).find(n => n.type === 'button').props.disabled, false);
  });
}
test('disabled environments never render the password-reset form', () => {
  const Page = load('src/app/forgot-password/page.tsx', {
    'next/link': { default: 'a' }, '@/components/PasswordResetForm': { default: 'reset-form' }, '@/lib/password-reset-policy': policy,
  }, { ...production, VERCEL_ENV: 'preview' }).default;
  assert.equal(nodes(Page()).some(n => n.type === 'reset-form'), false);
  assert.ok(text(Page()).includes('niet beschikbaar'));
});
test('logged-out users can reach only the exact reset route while app pages remain protected', () => {
  const { proxy } = load('src/proxy.ts', { 'next/server': { NextResponse } });
  assert.equal(proxy(new NextRequest('https://test.invalid/forgot-password')).status, 200);
  for (const path of ['/dashboard', '/security', '/forgot-password-extra']) {
    const response = proxy(new NextRequest('https://test.invalid' + path));
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get('location')).pathname, '/login');
  }
});
