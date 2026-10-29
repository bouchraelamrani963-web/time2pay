const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, stubs = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { module, exports: module.exports, Response, Request, Date, console, process,
    require: n => n === 'server-only' ? {} : Object.hasOwn(stubs,n) ? stubs[n] : require(n) });
  return module.exports;
}
const { processBillingEvent } = load('src/lib/billing-webhook.ts');
const { billingMessage } = load('src/lib/billing-message.ts');
const config = { accountId: 'acct_test', livemode: false, plans: { starter: { priceId: 'price_starter' } } };
function fixture() {
  let account = { userId: 'uid_test', customerId: 'cus_test', subscriptionId: 'sub_test' };
  let sub = { id: 'sub_test', customer: 'cus_test', livemode: false, status: 'past_due', metadata: { time2payUserId: 'uid_test' },
    items: { data: [{ price: { id: 'price_starter' } }] },
    latest_invoice: { id: 'in_test', customer: 'cus_test', livemode: false, status: 'open', amount_paid: 0, amount_remaining: 900 } };
  const receipts = new Map(), notices = new Map(); let failReceipt = false, retrieves = 0, tail = Promise.resolve();
  const tx = { $executeRaw: async () => {}, billingAccount: {
    findUnique: async () => account, update: async ({data}) => Object.assign(account,data),
  }, billingWebhookEvent: { findUnique: async ({where}) => receipts.get(where.accountId_eventId.eventId),
    create: async ({data}) => { if(failReceipt) throw Error('database interrupted'); receipts.set(data.eventId,data); } },
    billingNotice: { upsert: async ({where,create}) => { if(!notices.has(where.key)) notices.set(where.key,create); } } };
  const db = { $transaction: fn => {
    const run = tail.then(async () => {
      const savedNotices = new Map(notices), savedReceipts = new Map(receipts);
      try { return await fn(tx); } catch(e) {
        notices.clear(); for(const [k,v] of savedNotices) notices.set(k,v);
        receipts.clear(); for(const [k,v] of savedReceipts) receipts.set(k,v); throw e;
      }
    }); tail = run.catch(() => {}); return run;
  } };
  const stripe = { subscriptions: { retrieve: async () => { retrieves++; return sub; } } };
  function event(type='invoice.payment_failed',id='evt_test') { return {id,type,livemode:false,data:{object:
    type.startsWith('invoice.') ? {...sub.latest_invoice,parent:{subscription_details:{subscription:'sub_test'}}} :
      type.startsWith('checkout.') ? {mode:'subscription',payment_status:'paid',customer:'cus_test',subscription:'sub_test',
        metadata:{time2payUserId:'uid_test'},client_reference_id:'uid_test'} : {...sub}}}; }
  return { receipts,notices,stripe,db,event,get sub(){return sub},set sub(v){sub=v},get account(){return account},
    set account(v){account=v},set failReceipt(v){failReceipt=v},get retrieves(){return retrieves},
    send:(e=event()) => processBillingEvent(e,stripe,db,config) };
}
test('failed renewal records a durable notice and minimal event receipt',async()=>{
  const f=fixture();await f.send();assert.equal(f.receipts.size,1);assert.equal(f.notices.size,1);
  assert.equal([...f.notices.values()][0].kind,'PAYMENT_FAILED');
  assert.deepEqual(Object.keys([...f.receipts.values()][0]).sort(),['accountId','eventId','eventType']);
});
test('same event replay and simultaneous deliveries have one effect',async()=>{
  const f=fixture();await Promise.all([f.send(),f.send(),f.send()]);
  assert.equal(f.receipts.size,1);assert.equal(f.notices.size,1);assert.equal(f.retrieves,1);
});
test('different event IDs and subscription update coalesce the same invoice outcome',async()=>{
  const f=fixture();await f.send();await f.send(f.event('invoice.payment_failed','evt_other'));
  await f.send(f.event('customer.subscription.updated','evt_sub'));assert.equal(f.receipts.size,3);assert.equal(f.notices.size,1);
});
test('database interruption rolls back receipt and notice, then replay succeeds',async()=>{
  const f=fixture();f.failReceipt=true;await assert.rejects(f.send());assert.equal(f.notices.size,0);assert.equal(f.receipts.size,0);
  f.failReceipt=false;await f.send();assert.equal(f.notices.size,1);
});
test('late failure after recovery uses current state and never sends stale failure',async()=>{
  const f=fixture(),late=f.event();f.sub.status='active';f.sub.latest_invoice.status='paid';
  f.sub.latest_invoice.amount_paid=900;f.sub.latest_invoice.amount_remaining=0;
  await f.send(late);assert.equal([...f.notices.values()][0].kind,'PAYMENT_RECEIVED');
});
test('late paid event after a new failure cannot restore access or send paid notice',async()=>{
  const f=fixture(),old=f.event('invoice.paid');old.data.object.id='in_previous';
  await f.send(old);assert.equal(f.notices.size,0);assert.equal(f.receipts.size,1);
});
test('paid current invoice queues a recovery confirmation only once',async()=>{
  const f=fixture();f.sub.status='active';f.sub.latest_invoice.status='paid';f.sub.latest_invoice.amount_paid=900;
  await f.send(f.event('invoice.paid'));await f.send(f.event('customer.subscription.updated','evt_sub'));
  assert.equal(f.notices.size,1);assert.equal([...f.notices.values()][0].kind,'PAYMENT_RECEIVED');
});
test('cancellation records event without granting access or creating paid confirmation',async()=>{
  const f=fixture();f.sub.status='canceled';await f.send(f.event('customer.subscription.deleted'));
  assert.equal(f.receipts.size,1);assert.equal(f.notices.size,0);
});
test('wrong environment, owner or price fail before any receipt or notice',async()=>{
  for(const mutate of [f=>f.sub.livemode=true,f=>f.sub.customer='cus_other',f=>f.sub.items.data[0].price.id='price_other']){
    const f=fixture();mutate(f);await assert.rejects(f.send());assert.equal(f.receipts.size,0);assert.equal(f.notices.size,0);
  }
  const f=fixture(),e=f.event();e.livemode=true;await assert.rejects(f.send(e));
});
test('unmapped customer creates no application account; pending Checkout mapping is retryable',async()=>{
  const f=fixture();f.account=null;await f.send();assert.equal(f.receipts.size,0);assert.equal(f.notices.size,0);
  const g=fixture();g.account.subscriptionId=null;await assert.rejects(g.send());assert.equal(g.receipts.size,0);
});
test('old subscription event cannot alter current mapping',async()=>{
  const f=fixture();f.account.subscriptionId='sub_new';await f.send();assert.equal(f.notices.size,0);assert.equal(f.account.subscriptionId,'sub_new');
});
test('trusted paid Checkout links the existing customer only',async()=>{
  const f=fixture();f.account.subscriptionId=null;await f.send(f.event('checkout.session.completed'));
  assert.equal(f.account.subscriptionId,'sub_test');assert.equal(f.receipts.size,1);
  const g=fixture(),e=g.event('checkout.session.completed');e.data.object.client_reference_id='uid_other';
  await assert.rejects(g.send(e));assert.equal(g.receipts.size,0);
});
test('non-subscription invoices and unhandled events have no effects',async()=>{
  const f=fixture(),e=f.event();delete e.data.object.parent;await f.send(e);
  await f.send(f.event('charge.failed'));assert.equal(f.receipts.size,0);
});
test('customer message distinguishes valid free access from blocked paid actions',()=>{
  assert.match(billingMessage('past_due',false),/geblokkeerd/);
  assert.match(billingMessage('past_due',true),/gratis toegang blijft behouden/);
  assert.equal(billingMessage('active',false),null);
});

// Execute the actual entitlement composition with isolated Stripe/DB/Firebase boundaries.
test('past_due denies invoice actions after free expiry, preserves valid trial and recovers on payment',async()=>{
  const f=fixture();f.sub.items.data[0].current_period_end=Math.floor(Date.now()/1000)+3600;
  const policy=load('src/lib/billing-plans.ts');
  const billing=load('src/lib/billing.ts',{'./billing-plans':policy,
    './billing-environment':{getBillingEnvironment:()=>({...config,key:'synthetic'})},
    './prisma':{prisma:{billingAccount:{findUnique:async()=>f.account}}},
    stripe:{default:class{constructor(){this.subscriptions=f.stripe.subscriptions}}}});
  let trial=null;
  const access=load('src/lib/invoice-access.ts',{'./billing':billing,'./registration-trial':{getRegistrationTrial:async()=>trial}});
  assert.equal(await access.hasInvoiceAccess('uid_test'),false);
  trial={subscriptionId:'trial_test',periodEnd:Math.floor(Date.now()/1000)+3600,starter:false};
  assert.equal(await access.hasInvoiceAccess('uid_test'),true);
  trial=null;f.sub.status='active';f.sub.latest_invoice.status='paid';f.sub.latest_invoice.amount_paid=900;
  assert.equal(await access.hasInvoiceAccess('uid_test'),true);
  f.sub.status='canceled';assert.equal(await access.hasInvoiceAccess('uid_test'),false);
});
