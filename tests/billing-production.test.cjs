const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const Stripe=require('stripe');
function load(file,stubs={}) {
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {module,exports:module.exports,Response,Request,URL,console,process,require:n=>Object.hasOwn(stubs,n)?stubs[n]:require(n)});
 return module.exports;
}
const plans=load('src/lib/billing-plans.ts');
const config=load('src/lib/billing-environment.ts',{'server-only':{},'./billing-plans':plans});
const sandbox={VERCEL_ENV:'preview',TIME2PAY_BILLING_MODE:'test',STRIPE_TEST_RESTRICTED_KEY:'rk_test_synthetic'};
const production={VERCEL_ENV:'production',TIME2PAY_BILLING_MODE:'live',TIME2PAY_LIVE_PAYMENTS_ENABLED:'true',
 STRIPE_LIVE_RESTRICTED_KEY:'rk_live_synthetic',STRIPE_LIVE_ACCOUNT_ID:'acct_syntheticProduction',
 STRIPE_LIVE_WEBHOOK_SECRET:'whsec_synthetic',STRIPE_LIVE_STARTER_PRICE_ID:'price_syntheticStarter',
 STRIPE_LIVE_PRO_PRICE_ID:'price_syntheticPro',STRIPE_LIVE_BUSINESS_PRICE_ID:'price_syntheticBusiness'};

test('production configuration is read-only to inspect and cannot enable payments without separate permission',()=>{
 const env={...production,TIME2PAY_LIVE_PAYMENTS_ENABLED:undefined};
 assert.throws(()=>config.resolveBillingEnvironment(env));
 assert.equal(config.resolveBillingEnvironment(env,false).livemode,true);
 for(const value of ['false','TRUE','1',''])assert.throws(()=>config.resolveBillingEnvironment({...production,TIME2PAY_LIVE_PAYMENTS_ENABLED:value}));
});
test('sandbox configuration never selects live credentials or live prices',()=>{
 const selected=config.resolveBillingEnvironment({...sandbox,...Object.fromEntries(Object.entries(production).filter(([k])=>k.startsWith('STRIPE_LIVE_')))});
 assert.equal(selected.livemode,false);assert.equal(selected.key,sandbox.STRIPE_TEST_RESTRICTED_KEY);
 assert.equal(selected.plans.starter.priceId,plans.BILLING_PLANS.starter.priceId);
 assert.throws(()=>config.resolveBillingEnvironment({...production,VERCEL_ENV:'preview'}));
});
test('production rejects sandbox mode, credentials, account and price IDs',()=>{
 const invalid=[{...sandbox,VERCEL_ENV:'production'},
  {...production,STRIPE_TEST_RESTRICTED_KEY:'rk_test_synthetic'},
  {...production,STRIPE_TEST_WEBHOOK_SECRET:'whsec_otherSynthetic'},
  {...production,STRIPE_SECRET_KEY:'sk_test_synthetic'},
  {...production,STRIPE_PUBLISHABLE_KEY:'pk_test_synthetic'},
  {...production,STRIPE_LIVE_RESTRICTED_KEY:'rk_test_synthetic'},
  {...production,STRIPE_LIVE_ACCOUNT_ID:config.SANDBOX_ACCOUNT},
  {...production,STRIPE_LIVE_STARTER_PRICE_ID:plans.BILLING_PLANS.starter.priceId},
  {...production,STRIPE_LIVE_PRO_PRICE_ID:production.STRIPE_LIVE_STARTER_PRICE_ID}];
 for(const env of invalid)assert.throws(()=>config.resolveBillingEnvironment(env));
 for(const key of Object.keys(production).filter(k=>k.startsWith('STRIPE_LIVE_'))){
  const env={...production};delete env[key];assert.throws(()=>config.resolveBillingEnvironment(env));
 }
});
test('live billing accepts only HTTPS on the two production hosts',()=>{
 for(const origin of ['https://time2pay.nl','https://www.time2pay.nl'])assert.doesNotThrow(()=>config.assertBillingOrigin(new URL(origin),true));
 for(const origin of ['http://time2pay.nl','https://time2pay.nl.attacker.invalid','https://preview.vercel.app','https://time2pay.nl:444','https://user:pass@time2pay.nl'])assert.throws(()=>config.assertBillingOrigin(new URL(origin),true));
 assert.doesNotThrow(()=>config.assertBillingOrigin(new URL('https://preview.vercel.app'),false));
});
test('entitlements cannot mix sandbox and live subscriptions or bypass payment and expiry',()=>{
 const selected=config.resolveBillingEnvironment(production),now=Date.parse('2026-10-25T10:00:00Z');
 const policy={livemode:selected.livemode,priceIds:Object.values(selected.plans).map(p=>p.priceId)};
 const valid={livemode:true,status:'active',invoicePaid:true,priceId:selected.plans.starter.priceId,periodEnd:now/1000+3600};
 assert.equal(plans.grantsPaidAccess(valid,now,policy),true);
 for(const changes of [{livemode:false},{priceId:plans.BILLING_PLANS.starter.priceId},{status:'past_due'},
  {status:'canceled'},{invoicePaid:false},{periodEnd:now/1000}])assert.equal(plans.grantsPaidAccess({...valid,...changes},now,policy),false);
 assert.equal(plans.grantsPaidAccess(valid,now),false);
});
test('disabled live checkout and portal stop before Stripe or database side effects',async()=>{
 for(const file of ['checkout','portal']){
  let sideEffects=0;
  const route=load(`src/app/api/billing/${file}/route.ts`,{
   '@/lib/auth':{requireUserOrUnauthorized:async()=>({uid:'synthetic'})},
   '@/lib/registration-trial':{getRegistrationTrial:async()=>null},
   '@/lib/billing':{getStripe:()=>{sideEffects++;throw Error('must not reach Stripe');}},
   '@/lib/billing-environment':{...config,getBillingEnvironment:()=>config.resolveBillingEnvironment({...production,TIME2PAY_LIVE_PAYMENTS_ENABLED:undefined})},
   '@/lib/billing-plans':plans,'@/lib/prisma':{prisma:new Proxy({},{get(){sideEffects++;throw Error('must not reach database');}})}
  });
  const response=await route.POST(new Request(`https://time2pay.nl/api/billing/${file}`,{method:'POST',headers:{origin:'https://time2pay.nl','content-type':'application/json'},body:JSON.stringify({plan:'starter'})}));
  assert.equal(response.status,503);assert.equal(sideEffects,0);
 }
});

function checkoutFixture(overrides={}) {
 const selected=config.resolveBillingEnvironment(production);let created=0,stored=0;
 const stripe={accounts:{retrieveCurrent:async()=>({id:overrides.accountId||selected.accountId})},
 prices:{retrieve:async id=>({id,active:true,livemode:true,currency:'eur',
  unit_amount:Object.values(selected.plans).find(p=>p.priceId===id).cents,
  tax_behavior:'inclusive',recurring:{interval:'month',interval_count:1},...overrides.price})},
 tax:{registrations:{list:async()=>({data:overrides.tax||[{country:'NL',livemode:true}]})}},
 subscriptions:{list:async()=>({data:[]})},checkout:{sessions:{list:async()=>({data:[]}),
  create:async body=>{created++;assert.equal(body.mode,'subscription');assert.equal(body.automatic_tax.enabled,true);
   assert.ok(Object.values(selected.plans).some(p=>p.priceId===body.line_items[0].price));return {url:'https://checkout.stripe.com/synthetic'};}}}};
 const route=load('src/app/api/billing/checkout/route.ts',{'@/lib/auth':{requireUserOrUnauthorized:async()=>({uid:'synthetic'})},
  '@/lib/billing-environment':{...config,getBillingEnvironment:()=>selected},'@/lib/billing-plans':plans,
  '@/lib/registration-trial':{getRegistrationTrial:async()=>null},
  '@/lib/billing':{getStripe:()=>stripe,hasPaidSubscription:async()=>false},
  '@/lib/prisma':{prisma:{billingAccount:{createMany:async()=>{stored++;},findUniqueOrThrow:async()=>({customerId:'cus_synthetic'})}}}});
 return {created:()=>created,stored:()=>stored,send:(plan='starter',origin='https://time2pay.nl')=>route.POST(new Request(origin+'/api/billing/checkout',
  {method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({plan})}))};
}
test('live checkout validates all three actual monthly inclusive prices before creating a session',async()=>{
 const f=checkoutFixture();for(const plan of ['starter','pro','business'])assert.equal((await f.send(plan)).status,200);
 assert.equal(f.created(),3);
});
test('wrong live account, price mode/amount/currency/tax/interval and tax registration stop before storage or checkout',async()=>{
 for(const invalid of [{accountId:'acct_otherSynthetic'},{price:{livemode:false}}, {price:{active:false}},
  {price:{unit_amount:1}},{price:{currency:'usd'}},{price:{tax_behavior:'exclusive'}},
  {price:{recurring:{interval:'year',interval_count:1}}},{price:{recurring:{interval:'month',interval_count:2}}},
  {tax:[]},{tax:[{country:'NL',livemode:false}]}]){
  const f=checkoutFixture(invalid);assert.equal((await f.send()).status,503);assert.equal(f.created(),0);assert.equal(f.stored(),0);
 }
 const previewHost=checkoutFixture();assert.equal((await previewHost.send('starter','https://preview.vercel.app')).status,503);
 assert.equal(previewHost.created(),0);assert.equal(previewHost.stored(),0);
});
test('live Starter entitlement selects its live price for quota; Business does not inherit the cap',async()=>{
 const selected=config.resolveBillingEnvironment(production);let priceId=selected.plans.starter.priceId;
 const subscriptions={retrieve:async()=>({id:'sub_synthetic',livemode:true,status:'active',customer:'cus_synthetic',
  latest_invoice:{status:'paid',amount_paid:900},items:{data:[{price:{id:priceId},current_period_start:100,current_period_end:Math.floor(Date.now()/1000)+3600}]}})};
 const billing=load('src/lib/billing.ts',{'server-only':{},'./billing-environment':{getBillingEnvironment:()=>selected},
  './billing-plans':plans,'stripe':{default:class {constructor(){this.subscriptions=subscriptions;}}},
  './prisma':{prisma:{billingAccount:{findUnique:async()=>({subscriptionId:'sub_synthetic',customerId:'cus_synthetic'})}}}});
 assert.equal((await billing.getPaidEntitlement('synthetic')).starter,true);
 priceId=selected.plans.business.priceId;assert.equal((await billing.getPaidEntitlement('synthetic')).starter,false);
 priceId=plans.BILLING_PLANS.starter.priceId;assert.equal(await billing.getPaidEntitlement('synthetic'),null);
});

function webhookFixture(overrides={}) {
 const selected=config.resolveBillingEnvironment(production),sdk=new Stripe('rk_test_synthetic');
 let updates=0;const stripe={webhooks:sdk.webhooks,accounts:{retrieveCurrent:async()=>({id:overrides.accountId||selected.accountId})},
 subscriptions:{retrieve:async()=>({livemode:true,customer:'cus_synthetic',metadata:{time2payUserId:'synthetic'},
 items:{data:[{price:{id:overrides.priceId||selected.plans.starter.priceId}}]}})}};
 const route=load('src/app/api/billing/webhook/route.ts',{'@/lib/billing':{getStripe:()=>stripe},
 '@/lib/billing-environment':{getBillingEnvironment:()=>selected},'@/lib/prisma':{prisma:{billingAccount:{updateMany:async()=>{updates++;}}}}});
 const event={id:'evt_synthetic',object:'event',type:'checkout.session.completed',livemode:true,
 data:{object:{mode:'subscription',payment_status:'paid',customer:'cus_synthetic',subscription:'sub_synthetic',
 metadata:{time2payUserId:'synthetic'},client_reference_id:'synthetic'}}};
 async function send(data=event,secret=selected.webhookSecret,tamper=false){
  const payload=JSON.stringify(data),signature=sdk.webhooks.generateTestHeaderString({payload,secret});
  return route.POST(new Request('https://time2pay.nl/api/billing/webhook',{method:'POST',headers:{'stripe-signature':signature},body:tamper?payload+' ':payload}));
 }
 return {send,event,updates:()=>updates};
}
test('webhook uses real Stripe signature verification and rejects tampering, wrong secrets and sandbox events',async()=>{
 const f=webhookFixture();
 assert.equal((await f.send(f.event,'whsec_wrongSynthetic')).status,400);
 assert.equal((await f.send(f.event,undefined,true)).status,400);
 assert.equal((await f.send({...f.event,livemode:false})).status,400);
 assert.equal(f.updates(),0);
 assert.equal((await f.send()).status,200);assert.equal(f.updates(),1);
});
test('signed webhook from wrong account or unallowlisted price cannot update ownership mapping',async()=>{
 const otherAccount=webhookFixture({accountId:'acct_otherSynthetic'});
 assert.equal((await otherAccount.send()).status,400);assert.equal(otherAccount.updates(),0);
 const otherPrice=webhookFixture({priceId:'price_otherSynthetic'});
 assert.equal((await otherPrice.send()).status,200);assert.equal(otherPrice.updates(),0);
 const unpaid=webhookFixture();unpaid.event.data.object.payment_status='unpaid';
 assert.equal((await unpaid.send()).status,200);assert.equal(unpaid.updates(),0);
});
