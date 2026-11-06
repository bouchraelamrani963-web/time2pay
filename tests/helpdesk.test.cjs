const test = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpdesk-fixture.cjs');
const load = loader(); const policy = load('src/lib/helpdesk/policy.ts');
test('ticket input accepts Dutch text and rejects ownership, role and state injection', () => {
 const valid = { subject: 'Vraag over uren', category: 'HOURS', body: 'Hoe voeg ik mijn uren van maandag toe?' };
 assert.equal(policy.createTicketSchema.parse(valid).category, 'HOURS');
 for (const extra of [{ userId: 'other' }, { fromSupport: true }, { status: 'RESOLVED' }, { priority: 'HIGH' }, { number: 'TP-00001' }]) assert.equal(policy.createTicketSchema.safeParse({ ...valid, ...extra }).success, false);
 for (const invalid of [{ subject: ' ' }, { body: 'x'.repeat(8001) }, { category: 'UNKNOWN' }, { body: 'bad\u0000bodycontent' }]) assert.equal(policy.createTicketSchema.safeParse({ ...valid, ...invalid }).success, false);
});
test('known credentials are rejected in subjects and messages before persistence', () => {
 for (const body of ['Mijn wachtwoord: geheim!', 'password = hidden', 'Mijn code is 123456', 'ABCD-EF01-2345-6789-ABCD-EF01-2345-6789', 'herstelcode is geheim']) {
   assert.equal(policy.replySchema.safeParse({ body }).success, false);
   assert.equal(policy.createTicketSchema.safeParse({ subject: body, category: 'MFA', body: 'Een veilige omschrijving van de vraag.' }).success, false);
 }
 assert.equal(policy.replySchema.safeParse({ body: 'Mijn authenticator werkt niet meer.' }).success, true);
});
test('customer reply reopens a resolved/waiting ticket and staff reply waits on customer', () => {
 assert.equal(policy.replyStatus('RESOLVED', false), 'OPEN'); assert.equal(policy.replyStatus('WAITING_CUSTOMER', false), 'OPEN');
 assert.equal(policy.replyStatus('IN_PROGRESS', false), 'IN_PROGRESS'); assert.equal(policy.replyStatus('OPEN', true), 'WAITING_CUSTOMER');
 assert.equal(policy.replyStatus('RESOLVED', true), 'RESOLVED');
});
test('pagination and enums are bounded; malformed patches do not pass', () => {
 for (const page of [0, -1, 'NaN', '1.1', 100001]) assert.equal(policy.listSchema.safeParse({ page }).success, false);
 for (const input of [{}, { status: 'closed' }, { priority: 'urgent' }, { userId: 'other' }]) assert.equal(policy.updateTicketSchema.safeParse(input).success, false);
 assert.equal(policy.updateTicketSchema.safeParse({ status: 'IN_PROGRESS', priority: 'HIGH' }).success, true);
});
test('same-origin JSON writes and bounded bodies; no-store on unauthenticated responses', async () => {
 const http = loader({ '@/lib/auth': { requireUserOrUnauthorized: async () => new Response('', { status: 401 }) } })('src/lib/helpdesk/http.ts');
 const req = (headers, body='{}') => new Request('https://time2pay.example/api/helpdesk/tickets', { method: 'POST', headers, body });
 await assert.rejects(() => http.readBody(req({ origin: 'https://evil.example', 'content-type': 'application/json' })), e => e.status === 403);
 await assert.rejects(() => http.readBody(req({ origin: 'https://time2pay.example', 'content-type': 'text/plain' })), e => e.status === 415);
 await assert.rejects(() => http.readBody(req({ origin: 'https://time2pay.example', 'content-type': 'application/json' }, 'x'.repeat(40001))), e => e.status === 413);
 await assert.rejects(() => http.readBody(req({ origin: 'https://time2pay.example', 'content-type': 'application/json' }, '{')), e => e.status === 400);
 const response = await http.handleHelpdesk(() => { throw Error('must not run'); }); assert.equal(response.status, 401); assert.match(response.headers.get('cache-control'), /no-store/);
});
