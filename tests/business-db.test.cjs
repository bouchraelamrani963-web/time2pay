const assert = require("node:assert/strict");
const { AsyncLocalStorage } = require("node:async_hooks");
const fs = require("node:fs");
const path = require("node:path");
const { after, test } = require("node:test");
const ts = require("typescript");
const { PrismaClient } = require("@prisma/client");

const enabled = process.env.TIME2PAY_BUSINESS_DB_TEST === "true";
if (enabled) {
  const url = new URL(process.env.DATABASE_URL);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/time2pay_business_test") {
    throw new Error("Business tests require a disposable loopback database.");
  }
}

const db = enabled ? new PrismaClient() : null;
after(() => db?.$disconnect());

function fixture() {
  const active = new Map([["fiction-owner", "business"], ["fiction-other", "business"], ["fiction-pro", "pro"]]);
  const session = new AsyncLocalStorage();
  const deliveries = [];
  const stubs = {
    "server-only": {},
    "next/headers": { cookies: async () => ({ get: () => session.getStore() && { value: "fixture" } }) },
    "../billing": { getPaidEntitlement: async uid => active.has(uid) ? { plan: active.get(uid) } : null },
    "../prisma": { prisma: db },
    "./account-recovery": { recoveryLocked: async () => false },
    "./firebase-admin": { getAdminAuth: () => ({
      verifySessionCookie: async (_cookie, revocation) => {
        assert.equal(revocation, true);
        const user = session.getStore();
        return { uid: user.uid, email: user.tokenEmail ?? user.email, email_verified: !user.unverified,
          auth_time: Date.now() / 1000 - (user.stale ? 3600 : 0), firebase: user.noTotp ? {} : {
            sign_in_second_factor: "totp", second_factor_identifier: "factor-fictitious",
          } };
      },
      getUser: async () => {
        const user = session.getStore();
        return { email: user.email, emailVerified: !user.unverified,
          multiFactor: { enrolledFactors: [{ factorId: "totp", uid: "factor-fictitious" }] } };
      },
    }) },
    "../email": { getInvoiceEmailConfig: () => ({
      from: "test@example.test", testRecipient: "sink@example.test",
      resend: { emails: { send: async (message, options) => {
        deliveries.push({ message, options });
        return { error: null };
      } } },
    }) },
  };
  const modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function("module", "exports", "require", js)(module, module.exports, name => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      if (name.startsWith(".")) return load(path.resolve(path.dirname(filename), name + ".ts"));
      if (name.startsWith("@/")) return load(path.resolve("src", name.slice(2) + ".ts"));
      return require(name);
    });
    return module.exports;
  }

  const routes = load(path.resolve("src/app/api/business/[[...path]]/route.ts"));
  async function request(user, path, payload, expected = 200, origin = "https://time2pay.example.test") {
    return session.run(user, async () => {
      const req = new Request("https://time2pay.example.test/api/business/" + path.join("/"), payload ? {
        method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(payload),
      } : undefined);
      const ctx = { params: Promise.resolve({ path }) };
      const response = await (payload ? routes.POST(req, ctx) : routes.GET(req, ctx));
      const isPdf = response.headers.get("content-type") === "application/pdf";
      const data = isPdf ? Buffer.from(await response.arrayBuffer()) : await response.json();
      assert.equal(response.status, expected, JSON.stringify(data));
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      return data;
    });
  }
  return { request, active, deliveries };
}

const user = (name, changes) => ({ uid: "fiction-" + name, email: name + "@example.test", ...changes });
const settings = {
  companyName: "Fictief Bouwteam", contactName: "Test Eigenaar", street: "Teststraat 1", postalCode: "1000AA",
  city: "Teststad", kvkNumber: "12345678", vatId: "NL000000000B00", iban: "NL91 ABNA 0417 1643 00",
  email: "boekhouding@example.test", phone: "",
};

test("migration preserves personal invoices, numbering, customer and Stripe mapping", { skip: !enabled }, async () => {
  const legacy = await db.invoice.findUniqueOrThrow({ where: { id: "fiction-private-invoice" }, include: { client: true } });
  assert.deepEqual([legacy.userId, legacy.companyId, legacy.number, legacy.status, legacy.subtotal, legacy.vatAmount, legacy.total, legacy.client.name],
    ["fiction-owner", null, "F2026-0789", "PAID", 100, 21, 121, "Privéklant voor migratie"]);
  const billing = await db.billingAccount.findUniqueOrThrow({ where: { userId: legacy.userId } });
  assert.deepEqual([billing.customerId, billing.subscriptionId], ["cus_fiction", "sub_fiction"]);
  await assert.rejects(db.invoice.create({ data: {
    userId: legacy.userId, number: legacy.number, clientId: legacy.clientId, dueDate: new Date(),
  } }), { code: "P2002" });
});

test("Business API enforces identity, tenant and role, preserves snapshots and safely pauses access", { skip: !enabled }, async () => {
  process.env.TIME2PAY_BUSINESS_ENABLED = "true";
  const { request, active, deliveries } = fixture();
  const owner = user("owner");
  const employee = user("employee");
  const admin = user("admin");
  const other = user("other");
  await request(null, [], null, 401);
  await request(user("owner", { noTotp: true }), [], null, 401);
  await request(user("owner", { unverified: true }), [], null, 401);
  await request(user("owner", { tokenEmail: "old@example.test" }), [], null, 401);
  await request(user("pro"), [], { action: "createCompany", name: "Fictief" }, 402);
  await request(owner, [], { action: "createCompany", name: "Fictief" }, 403, "https://other.example.test");

  const { id } = await request(owner, [], { action: "createCompany", name: settings.companyName }, 201);
  const { id: otherId } = await request(other, [], { action: "createCompany", name: "Ander fictief bedrijf" }, 201);
  const company = [id];
  await request(other, company, null, 404);
  const saveSettings = { action: "settings", settings, invoicePrefix: "DEMO", invoiceTemplate: "Fictieve standaardtekst" };
  await request(user("owner", { stale: true }), company, saveSettings, 403);
  await request(owner, company, { ...saveSettings, settings: { ...settings, iban: "NL91ABNA0417164301" } }, 422);
  await request(owner, company, saveSettings);

  const first = await request(owner, company, null);
  assert.equal(first.clients.length, 0);
  assert.equal(first.invoices.length, 0);
  const invite = (name, role = "EMPLOYEE") => ({ action: "invite", email: name + "@example.test", role });
  await request(owner, company, invite("admin", "ADMINISTRATION"));
  await request(owner, company, invite("employee"));
  const invitation = await request(employee, [], null);
  const employeeSeat = invitation.invitations[0].id;
  await request(other, company, { action: "accept", seatId: employeeSeat }, 404);
  await request(employee, company, { action: "accept", seatId: employeeSeat });
  const adminSeat = (await request(admin, [], null)).invitations[0].id;
  await request(admin, company, { action: "accept", seatId: adminSeat });

  const seatOutcomes = await Promise.allSettled(["third", "fourth", "fifth"].map(name =>
    request(owner, company, invite(name))));
  assert.equal(seatOutcomes.filter(x => x.status === "fulfilled").length, 2);
  assert.match(String(seatOutcomes.find(x => x.status === "rejected").reason), /vijf gebruikersplaatsen/);
  const full = (await request(owner, company, null)).seats;
  assert.equal(full.length + 1, 5);
  await assert.rejects(db.businessSeat.create({ data: {
    companyId: id, slot: 6, email: "sixth@example.test", role: "EMPLOYEE", expiresAt: new Date(),
  } }));
  const pending = full.find(seat => seat.expiresAt);
  await request(owner, company, { action: "removeSeat", seatId: pending.id });
  await request(user(pending.email.split("@")[0]), company, { action: "accept", seatId: pending.id }, 404);
  await request(owner, company, invite("replacement"));
  const replacement = (await request(user("replacement"), [], null)).invitations[0];
  await db.businessSeat.update({ where: { id: replacement.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await request(user("replacement"), company, { action: "accept", seatId: replacement.id }, 404);
  await request(owner, company, invite("replacement"));

  const addClient = { action: "client", client: { name: "Fictieve klant", email: "client@example.test",
    phone: "0612345678", address: "Testadres", vatNumber: "FICTIEF" } };
  const customer = await request(admin, company, addClient);
  const foreignCustomer = await request(other, [otherId], addClient);
  await request(admin, company, { ...addClient, clientId: foreignCustomer.id }, 404);
  await request(employee, company, addClient, 403);
  await request(admin, company, saveSettings, 403);
  await request(employee, company, saveSettings, 403);
  await request(admin, company, invite("forbidden"), 403);

  const payload = { action: "draft", invoice: { clientId: customer.id, dueDate: "2099-01-01", vatRate: 21,
    items: [{ type: "HOURS", description: "Fictief werk", quantity: 2, unitPrice: 50 }] } };
  const employeeInvoice = await request(employee, company, payload);
  const adminInvoice = await request(admin, company, payload);
  await request(employee, company, { ...payload, invoiceId: adminInvoice.id }, 404);
  await request(employee, company, { ...payload, invoice: { ...payload.invoice, clientId: foreignCustomer.id } }, 404);
  await request(employee, company, { ...payload, invoice: { ...payload.invoice, clientId: "fiction-private-client" } }, 404);
  await request(employee, company, { action: "deleteDraft", invoiceId: employeeInvoice.id }, 403);
  await request(employee, company, { action: "finalize", invoiceId: employeeInvoice.id }, 403);
  await assert.rejects(db.invoice.create({ data: {
    companyId: id, createdByUid: employee.uid, number: "D-invalid-company-client",
    clientId: foreignCustomer.id, dueDate: new Date(),
  } }), { code: "P2003" });
  await request(employee, company, { action: "payment", invoiceId: employeeInvoice.id, paid: true }, 403);
  await request(employee, company, { action: "send", invoiceId: employeeInvoice.id }, 403);
  await request(employee, [...company, "pdf", employeeInvoice.id], null, 403);
  const employeeView = await request(employee, company, null);
  assert.deepEqual(employeeView.invoices.map(invoice => invoice.id), [employeeInvoice.id]);
  assert.equal(employeeView.settings, null);
  assert.equal(employeeView.report, null);
  assert.equal(employeeView.seats, null);
  assert.equal("email" in employeeView.clients[0], false);
  assert.equal("address" in employeeView.clients[0], false);
  assert.equal("phone" in employeeView.clients[0], false);

  await request(admin, company, { action: "finalize", invoiceId: employeeInvoice.id });
  await request(admin, company, { ...payload, invoiceId: employeeInvoice.id }, 404);
  await request(other, [otherId, "pdf", employeeInvoice.id], null, 404);
  assert.equal((await request(employee, company, null)).invoices.length, 0);
  const adminView = await request(admin, company, null);
  assert.equal(adminView.settings, null);
  assert.equal(adminView.report[0]._sum.total, 121);
  const finalized = adminView.invoices.find(item => item.id === employeeInvoice.id);
  assert.match(finalized.number, /^DEMO-\d{4}-00001$/);

  const pdfPath = [...company, "pdf", employeeInvoice.id];
  const pdf = await request(admin, pdfPath, null);
  assert.match(pdf.toString(), /^%PDF/);
  await request(owner, company, { ...saveSettings, settings: { ...settings, companyName: "Nieuwe fictieve naam", iban: "NL20INGB0001234567", pdfStyle: "NEUTRAL" } });
  await request(admin, company, { ...addClient, clientId: customer.id, client: { ...addClient.client, name: "Andere klantnaam" } });
  assert.deepEqual(await request(admin, pdfPath, null), pdf);
  assert.equal((await request(owner, company, null)).settings.pdfStyle, "NEUTRAL");
  await Promise.all([1, 2].map(() => request(admin, company, { action: "send", invoiceId: employeeInvoice.id })));
  assert.equal(deliveries.filter(entry => entry.options?.idempotencyKey === "business/invoice/" + employeeInvoice.id).length, 1);
  assert.equal(deliveries.every(entry => entry.message.to === "sink@example.test"), true);
  await db.invoice.update({ where: { id: employeeInvoice.id }, data: { dueDate: new Date("2020-01-01") } });
  await request(admin, company, { action: "remind", invoiceId: employeeInvoice.id });
  await request(admin, company, { action: "remind", invoiceId: employeeInvoice.id }, 409);
  await request(admin, company, { action: "payment", invoiceId: employeeInvoice.id, paid: true });
  assert.equal((await request(admin, company, null)).report[0].status, "PAID");
  assert.equal(await db.invoiceIssue.count({ where: { invoiceId: employeeInvoice.id } }), 0);

  await request(owner, company, { action: "changeRole", seatId: adminSeat, role: "EMPLOYEE" });
  await request(admin, pdfPath, null, 403);
  await request(owner, company, { action: "removeSeat", seatId: employeeSeat });
  await request(employee, company, null, 404);
  await request(employee, company, payload, 404);

  for (const plan of ["starter", "pro", null]) {
    if (plan) active.set(owner.uid, plan); else active.delete(owner.uid);
    await request(admin, company, null, 402);
    await request(owner, company, payload, 402);
    assert.equal((await request(owner, company, null)).active, false);
    assert.match((await request(owner, pdfPath, null)).toString(), /^%PDF/);
  }
  await request(owner, company, { action: "removeSeat", seatId: adminSeat });
  await request(admin, company, null, 404);

  const audit = await db.businessAuditEvent.findMany({ where: { companyId: id } });
  assert.ok(audit.some(entry => entry.action === "COMPANY_IBAN_UPDATED"));
  assert.ok(audit.some(entry => entry.action === "MEMBERSHIP_REVOKED"));
  assert.doesNotMatch(JSON.stringify(audit), /ABNA|INGB|@example|Fictieve standaardtekst/);
  process.env.TIME2PAY_BUSINESS_ENABLED = "false";
  await request(owner, company, null, 404);
});
