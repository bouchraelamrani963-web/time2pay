const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, stubs, env = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, Response, Request, URL, Buffer,
    process: { env }, console: { error() {} }, Set,
    require: name => Object.hasOwn(stubs, name) ? stubs[name] : require(name) });
  return module.exports;
}

test('Preview cannot reuse the production mail key or send without explicit test configuration', () => {
  const env = { VERCEL_ENV: 'preview', RESEND_API_KEY: 'production-key', INVOICE_FROM_EMAIL: 'sender@example.com' };
  let usedKey;
  const config = load('src/lib/email.ts', { resend: { Resend: class { constructor(key) { usedKey = key; } } } }, env);
  assert.throws(() => config.getInvoiceEmailConfig(), /Testmail/);
  env.TIME2PAY_EMAIL_MODE = 'test';
  assert.throws(() => config.getInvoiceEmailConfig(), /sleutel/);
  env.RESEND_TEST_API_KEY = 'separate-test-key';
  const result = config.getInvoiceEmailConfig();
  assert.equal(usedKey, 'separate-test-key');
  assert.equal(result.testRecipient, 'delivered@resend.dev');
  assert.equal(result.from, 'Time2Pay test <testmail@time2pay.nl>');
});

test('Production keeps its configured sender and has no test recipient override', () => {
  const config = load('src/lib/email.ts', { resend: { Resend: class {} } }, {
    VERCEL_ENV: 'production', RESEND_API_KEY: 'production-key', INVOICE_FROM_EMAIL: 'sender@example.com',
  }).getInvoiceEmailConfig();
  assert.equal(config.from, 'sender@example.com');
  assert.equal(config.testRecipient, undefined);
});

for (const kind of ['send', 'remind']) {
  for (const fail of [false, true]) {
    test(`${kind}: test recipient, PDF and escaped content; status changes only after provider success (${fail ? 'failure' : 'success'})`, async () => {
      const writes = [];
      let message;
      const pdf = Buffer.from('%PDF-test');
      const invoice = { id: 'invoice-test', userId: 'owner', number: 'F-TEST', status: kind === 'send' ? 'DRAFT' : 'SENT',
        client: { name: '<script>Test</script>', email: 'real-customer@example.com' },
        issueDate: new Date('2026-10-23'), dueDate: new Date('2026-11-06'), total: 12.1, subtotal: 10, vatRate: 21, vatAmount: 2.1,
        notes: '<b>Test only</b>', items: [{ type: 'HOURS', description: '<script>work</script>', quantity: 1, unitPrice: 10, lineTotal: 10, unit: 'uur' }] };
      const route = load(`src/app/api/invoices/[id]/${kind}/route.ts`, {
        '@/lib/invoice-email-content': load('src/lib/invoice-email-content.ts', { './shift-rates': load('src/lib/shift-rates.ts', {}) }),
        '@/lib/auth': { requireUserOrUnauthorized: async () => ({ uid: 'owner', name: 'Owner' }) },
        '@/lib/billing': { hasPaidSubscription: async () => true },
        '@/lib/prisma': { prisma: { invoice: {
          findFirst: async ({ where }) => { assert.equal(where.userId, 'owner'); return invoice; },
          updateMany: async data => { assert.ok(message); writes.push(data); return { count: 1 }; },
        }, companySettings: { findUnique: async () => null } } },
        '@/lib/email': { EmailConfigurationError: class extends Error {}, getInvoiceEmailConfig: () => ({
          from: 'onboarding@resend.dev', testRecipient: 'delivered@resend.dev', resend: { emails: { send: async data => {
            assert.equal(writes.length, 0); message = data;
            return { error: fail ? { message: 'Simulated failure' } : null };
          } } },
        }) },
        '@/lib/invoice-pdf': { buildInvoicePdf: () => pdf, getInvoicePdfFilename: () => 'F-TEST.pdf' },
      });
      const response = await route.POST(new Request('https://test.example'), { params: { id: invoice.id } });
      assert.equal(response.status, fail ? 502 : 200);
      assert.equal(message.to, 'delivered@resend.dev');
      assert.match(message.subject, /^\[TEST\]/);
      assert.ok(!message.html.includes('<script>'));
      assert.ok(message.html.includes('&lt;script&gt;'));
      assert.equal(message.attachments[0].content, pdf);
      assert.equal(message.attachments[0].contentType, 'application/pdf');
      assert.equal(writes.length, fail ? 0 : 1);
      if (!fail) assert.equal((await response.json()).sentTo, 'delivered@resend.dev');
    });
  }
}
