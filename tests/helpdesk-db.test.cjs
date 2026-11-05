const test = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpdesk-fixture.cjs');
const enabled = process.env.TIME2PAY_HELPDESK_DB_TEST === 'true';
test('real PostgreSQL: API ownership, support role, lifecycle, limits and pagination', { skip: !enabled }, async t => {
 const url = new URL(process.env.DATABASE_URL || 'https://invalid');
 assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/time2pay_helpdesk_ci', 'Only the disposable loopback helpdesk test database is allowed');
 const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
 const a = { uid: 'helpdesk-fictional-a', email: 'a@example.invalid', name: 'Studio Van Dijk' };
 const b = { uid: 'helpdesk-fictional-b', email: 'b@example.invalid', name: 'Jansen Installaties' };
 const agent = { uid: 'helpdesk-fictional-support', email: 'support@example.invalid', name: 'Support' }; let current = a;
 const load = loader({ '@/lib/prisma': { prisma }, '@/lib/auth': { requireUserOrUnauthorized: async () => current || new Response('', { status: 401 }) } });
 const service = load('src/lib/helpdesk/service.ts'), collection = load('src/app/api/helpdesk/tickets/route.ts'), item = load('src/app/api/helpdesk/tickets/[id]/route.ts'), messages = load('src/app/api/helpdesk/tickets/[id]/messages/route.ts');
 const request = (path, method='GET', body, origin='https://test.example') => new Request('https://test.example/api/helpdesk/tickets'+path, { method, headers: { origin, 'content-type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
 const ctx = id => ({ params: Promise.resolve({ id }) });
 const payload = { subject: 'Factuur versturen lukt niet', category: 'INVOICE', body: 'Ik krijg een melding bij het versturen van mijn fictieve factuur.' }; let ticket, other;
 try {
  await prisma.supportMessage.deleteMany(); await prisma.supportTicket.deleteMany(); await prisma.supportAgent.deleteMany();
  await t.test('create uses authenticated identity, default state and unique sequence', async () => {
   const created = await collection.POST(request('', 'POST', payload)); assert.equal(created.status, 201); ticket = await created.json();
   assert.match(ticket.number, /^TP-\d{5,}$/); assert.equal(ticket.customerName, a.name); assert.equal(ticket.status, 'OPEN'); assert.equal(ticket.priority, 'NORMAL');
   current = b; other = await (await collection.POST(request('', 'POST', { ...payload, subject: 'Andere klantvraag' }))).json(); assert.notEqual(other.number, ticket.number);
  });
  await t.test('list and status counts contain only own tickets; cross-tenant reads and replies return 404', async () => {
   const list = await (await collection.GET(request(''))).json(); assert.equal(list.total, 1); assert.equal(list.tickets[0].id, other.id); assert.equal(list.counts.OPEN, 1);
   assert.equal((await item.GET(request('/'+ticket.id), ctx(ticket.id))).status, 404);
   assert.equal((await messages.POST(request('/'+ticket.id+'/messages', 'POST', { body: 'Foreign reply' }), ctx(ticket.id))).status, 404);
   assert.equal((await item.GET(request('/missing'), ctx('missing'))).status, 404);
  });
  await t.test('customer cannot query support view, forge a role, or patch state', async () => {
   assert.equal((await collection.GET(request('?view=support'))).status, 403);
   assert.equal((await messages.POST(request('/'+other.id+'/messages?view=support', 'POST', { body: 'Forgery' }), ctx(other.id))).status, 403);
   assert.equal((await item.PATCH(request('/'+other.id, 'PATCH', { status: 'RESOLVED' }), ctx(other.id))).status, 403);
   assert.equal((await collection.POST(request('', 'POST', { ...payload, userId: a.uid }))).status, 422);
  });
  await t.test('CSRF, secrets and oversized messages fail without storing anything', async () => {
   const count = await prisma.supportMessage.count();
   assert.equal((await messages.POST(request('/'+other.id+'/messages', 'POST', { body: 'Test reply' }, 'https://evil.example'), ctx(other.id))).status, 403);
   assert.equal((await messages.POST(request('/'+other.id+'/messages', 'POST', { body: 'Mijn wachtwoord: geheim' }), ctx(other.id))).status, 422);
   assert.equal((await messages.POST(request('/'+other.id+'/messages', 'POST', { body: 'x'.repeat(8001) }), ctx(other.id))).status, 422);
   assert.equal(await prisma.supportMessage.count(), count);
  });
  await t.test('support sees all, can search exact number/client/subject, filter and answer', async () => {
   await prisma.supportAgent.create({ data: { userId: agent.uid } }); current = agent;
   for (const q of [ticket.number, a.name, 'versturen']) { const result = await (await collection.GET(request('?view=support&q='+encodeURIComponent(q)))).json(); assert.ok(result.tickets.some(t => t.id === ticket.id)); }
   const response = await item.PATCH(request('/'+ticket.id, 'PATCH', { status: 'IN_PROGRESS', priority: 'HIGH' }), ctx(ticket.id)); assert.equal(response.status, 200);
   const filtered = await (await collection.GET(request('?view=support&status=IN_PROGRESS&priority=HIGH'))).json(); assert.equal(filtered.total, 1); assert.equal(filtered.tickets[0].id, ticket.id);
   const replied = await messages.POST(request('/'+ticket.id+'/messages?view=support', 'POST', { body: 'Controleer de gegevens van je fictieve klant.' }), ctx(ticket.id)); assert.equal(replied.status, 201);
   const detail = await replied.json(); assert.equal(detail.status, 'WAITING_CUSTOMER'); assert.equal(detail.messages.at(-1).fromSupport, true);
  });
  await t.test('owner reads support reply, responds and reopens after resolution', async () => {
   current = a; let detail = await (await item.GET(request('/'+ticket.id), ctx(ticket.id))).json(); assert.equal(detail.messages.at(-1).fromSupport, true);
   detail = await (await messages.POST(request('/'+ticket.id+'/messages', 'POST', { body: 'Dat heb ik gecontroleerd, bedankt.' }), ctx(ticket.id))).json(); assert.equal(detail.status, 'OPEN'); assert.equal(detail.messages.at(-1).fromSupport, false);
   current = agent; await item.PATCH(request('/'+ticket.id, 'PATCH', { status: 'RESOLVED' }), ctx(ticket.id));
   current = a; detail = await (await messages.POST(request('/'+ticket.id+'/messages', 'POST', { body: 'Ik heb nog een vervolgvraag.' }), ctx(ticket.id))).json(); assert.equal(detail.status, 'OPEN');
  });
  await t.test('revoked support role is denied on the next list/read/reply/update', async () => {
   await prisma.supportAgent.update({ where: { userId: agent.uid }, data: { enabled: false } }); current = agent;
   assert.equal((await collection.GET(request('?view=support'))).status, 403);
   assert.equal((await item.GET(request('/'+ticket.id+'?view=support'), ctx(ticket.id))).status, 403);
   assert.equal((await messages.POST(request('/'+ticket.id+'/messages?view=support', 'POST', { body: 'Blocked reply' }), ctx(ticket.id))).status, 403);
   assert.equal((await item.PATCH(request('/'+ticket.id, 'PATCH', { priority: 'LOW' }), ctx(ticket.id))).status, 403);
  });
  await t.test('conversation pagination is stable and cannot use another ticket cursor', async () => {
   current = a; const start = Date.now() - 3600000;
   await prisma.supportMessage.createMany({ data: Array.from({ length: 55 }, (_, i) => ({ id: 'fictional-page-'+String(i).padStart(3,'0'), ticketId: ticket.id, authorId: a.uid, fromSupport: false, body: 'Fictief oud bericht '+i, createdAt: new Date(start+i) })) });
   const first = await service.getTicket(a, false, ticket.id); assert.equal(first.messages.length, 50); assert.equal(first.hasOlderMessages, true);
   const older = await service.getTicket(a, false, ticket.id, first.messages[0].id); assert.ok(older.messages.length > 0); assert.equal(older.hasOlderMessages, false);
   assert.equal(new Set([...older.messages, ...first.messages].map(m => m.id)).size, older.messages.length + first.messages.length);
   const foreignMessage = await prisma.supportMessage.findFirst({ where: { ticketId: other.id } }); await assert.rejects(() => service.getTicket(a, false, ticket.id, foreignMessage.id), e => e.status === 404);
  });
  await t.test('concurrent creation observes the per-user limit with no duplicate numbers', async () => {
   const burst = { uid: 'helpdesk-fictional-burst', email: 'burst@example.invalid', name: 'Fictieve monteur' };
   const results = await Promise.allSettled(Array.from({ length: 12 }, () => service.createTicket(burst, payload)));
   const good = results.filter(r => r.status === 'fulfilled'); assert.equal(good.length, 10); assert.equal(new Set(good.map(r => r.value.number)).size, 10);
   assert.ok(results.filter(r => r.status === 'rejected').every(r => r.reason.status === 429));
  });
  await t.test('message burst limit is enforced; unauthenticated API returns 401/no-store', async () => {
   current = b;
   await prisma.supportMessage.createMany({ data: Array.from({ length: 29 }, () => ({ ticketId: other.id, authorId: b.uid, fromSupport: false, body: 'Fictieve testreactie' })) });
   assert.equal((await messages.POST(request('/'+other.id+'/messages', 'POST', { body: 'Rate-limited reply' }), ctx(other.id))).status, 429);
   current = null; const r = await collection.GET(request('')); assert.equal(r.status, 401); assert.match(r.headers.get('cache-control'), /no-store/);
  });
 } finally { await prisma.supportMessage.deleteMany(); await prisma.supportTicket.deleteMany(); await prisma.supportAgent.deleteMany(); await prisma.$disconnect(); }
});
