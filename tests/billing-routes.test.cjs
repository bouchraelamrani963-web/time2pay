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
    '@/lib/auth': { requireUserOrUnauthorized: async () => user },
    '@/lib/billing': { hasPaidSubscription: async () => paid,
      paymentRequired: () => NextResponse.json({ code: 'SUBSCRIPTION_REQUIRED' }, { status: 402 }) },
    '@/lib/prisma': { prisma: fail },
    '@/lib/email': {}, '@/lib/invoice-pdf': {}, '@/lib/calculations': {}, '@/lib/invoice-status': {},
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
