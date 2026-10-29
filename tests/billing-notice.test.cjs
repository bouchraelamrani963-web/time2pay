const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(change={}) {
 const now=new Date();let sent=0,body,headers,fail=false;
 const notice={id:'notice_test',userId:'uid_test',customerId:'cus_test',subscriptionId:'sub_test',invoiceId:'in_test',
  kind:'PAYMENT_FAILED',createdAt:now,nextAttemptAt:now,attempts:0,firstAttemptAt:null,sentAt:null,failedAt:null,suppressedAt:null,leaseUntil:null,...change};
 const sub={id:'sub_test',customer:'cus_test',livemode:false,status:'past_due',items:{data:[{price:{id:'price_test'}}]},
  latest_invoice:{id:'in_test',livemode:false,status:'open',amount_remaining:900,amount_paid:0}};
 const user={email:'private@example.invalid',emailVerified:true,disabled:false};
 const prisma={billingAccount:{findUnique:async()=>({customerId:'cus_test',subscriptionId:'sub_test'})},billingNotice:{
  findUnique:async()=>notice,updateMany:async({where,data})=>{
   if(where.sentAt===null&&(notice.sentAt||notice.failedAt||notice.suppressedAt||notice.leaseUntil>Date.now()))return{count:0};
   if(where.leaseToken&&where.leaseToken!==notice.leaseToken)return{count:0};
   if(where.attempts&&where.attempts!==notice.attempts)return{count:0};
   if(data.attempts){notice.attempts++;data={...data};delete data.attempts;}Object.assign(notice,data);return{count:1};
  }}};
 function load(file,stubs={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {module,exports:module.exports,Date,AbortSignal,console,process:{env:{TIME2PAY_BILLING_NOTICES_ENABLED:'true'}},
   fetch:async(url,opts)=>{sent++;body=JSON.parse(opts.body);headers=opts.headers;if(fail)throw Error('transport failed');return{ok:true,json:async()=>({id:'provider_test'})}},
   require:n=>n==='server-only'?{}:Object.hasOwn(stubs,n)?stubs[n]:require(n)});return module.exports;}
 const policy=load('src/lib/security-notice-policy.ts');
 const worker=load('src/lib/billing-notice-worker.ts',{'./prisma':{prisma},'./billing':{getStripe:()=>({subscriptions:{retrieve:async()=>sub}})},
  './billing-environment':{getBillingEnvironment:()=>({livemode:false,plans:{starter:{priceId:'price_test'}}})},
  './firebase-admin':{getAdminAuth:()=>({getUser:async()=>user})},
  './email':{getInvoiceEmailConfig:()=>({resend:{key:'synthetic'},from:'test@example.invalid',testRecipient:'delivered@resend.dev'})},
  './security-notice-policy':policy});
 return{notice,sub,user,run:()=>worker.attemptBillingNotice(notice.id),get sent(){return sent},get body(){return body},get headers(){return headers},set fail(v){fail=v}};
}
test('Preview billing mail goes only to test sink; repeated delivery is idempotent',async()=>{
 const f=fixture();assert.equal((await f.run()).done,true);await f.run();assert.equal(f.sent,1);
 assert.deepEqual(f.body.to,['delivered@resend.dev']);assert.match(f.body.subject,/TEST/);
 assert.equal(f.headers['Idempotency-Key'],'billing-notice-notice_test');assert.ok(f.notice.sentAt);
 assert.match(f.body.text,/gratis periode blijft behouden/);assert.doesNotMatch(JSON.stringify(f.body),/private@example/);
});
test('provider failure schedules retry and replay uses the same provider idempotency key',async()=>{
 const f=fixture();f.fail=true;assert.equal((await f.run()).done,false);assert.equal(f.notice.sentAt,null);
 const key=f.headers['Idempotency-Key'];f.notice.nextAttemptAt=new Date(0);f.fail=false;
 assert.equal((await f.run()).done,true);assert.equal(f.headers['Idempotency-Key'],key);assert.equal(f.notice.attempts,2);
});
test('failed notice is suppressed after payment recovery before email is sent',async()=>{
 const f=fixture();f.sub.status='active';f.sub.latest_invoice.status='paid';f.sub.latest_invoice.amount_paid=900;
 await f.run();assert.equal(f.sent,0);assert.ok(f.notice.suppressedAt);
});
test('paid notice is suppressed after another renewal or subscription change',async()=>{
 const f=fixture({kind:'PAYMENT_RECEIVED'});f.sub.latest_invoice.id='in_new';await f.run();assert.equal(f.sent,0);assert.ok(f.notice.suppressedAt);
});
test('no email goes to an unverified or disabled Firebase identity',async()=>{
 for(const mutate of [f=>f.user.emailVerified=false,f=>f.user.disabled=true,f=>f.user.email=null]){
  const f=fixture();mutate(f);assert.equal((await f.run()).done,false);assert.equal(f.sent,0);
 }
});
test('send lease prevents concurrent workers from sending twice',async()=>{
 const f=fixture();await Promise.all([f.run(),f.run()]);assert.equal(f.sent,1);
});
test('expired delivery window is terminal and cannot create a second email',async()=>{
 const f=fixture({attempts:1,firstAttemptAt:new Date(Date.now()-24*3600000)});
 assert.equal((await f.run()).done,true);assert.equal(f.sent,0);assert.ok(f.notice.failedAt);
});
test('paid notification confirms receipt without bypassing the invoice access check',async()=>{
 const f=fixture({kind:'PAYMENT_RECEIVED'});f.sub.status='active';f.sub.latest_invoice.status='paid';f.sub.latest_invoice.amount_paid=900;
 await f.run();assert.equal(f.sent,1);assert.match(f.body.subject,/ontvangen/);assert.match(f.body.text,/iedere factuuractie/);
});

test('billing retry Workflow sleeps until the saved retry time and carries only the outbox ID',async()=>{
 const {load}=require('./recovery-fixture.cjs');let attempts=0;const dates=[];
 const flow=load('src/workflows/billing-notice.ts',{
  workflow:{sleep:async date=>dates.push(date.toISOString())},
  '../lib/billing-notice-worker':{attemptBillingNotice:async id=>{
   assert.equal(id,'opaque_billing_id');return ++attempts===1?{done:false,retryAt:'2026-10-29T12:00:00Z'}:{done:true};
  }}});
 await flow.billingNoticeWorkflow('opaque_billing_id');assert.equal(attempts,2);assert.deepEqual(dates,['2026-10-29T12:00:00.000Z']);
});
test('billing sweep requires the server secret even when security notices are disabled',async()=>{
 const {load,env}=require('./recovery-fixture.cjs');let calls=0;
 const route=load('src/app/api/internal/security-notices/route.ts',{
  '@/lib/security-notice-dispatch':{dispatchSecurityNotices:async()=>{throw Error('Security dispatcher is disabled')}},
  '@/lib/billing-notice-dispatch':{dispatchBillingNotices:async()=>{calls++;return 1}},
 },{...env,TIME2PAY_RECOVERY_ENABLED:'false',TIME2PAY_BILLING_NOTICES_ENABLED:'true',CRON_SECRET:'x'.repeat(40)});
 assert.equal((await route.GET(new Request('https://preview.invalid',{headers:{authorization:'Bearer wrong'}}))).status,401);
 assert.equal(calls,0);
 const response=await route.GET(new Request('https://preview.invalid',{headers:{authorization:'Bearer '+'x'.repeat(40)}}));
 assert.equal(response.status,200);assert.equal((await response.json()).billingDispatched,1);assert.equal(calls,1);
});
test('billing dispatch is disabled by default and does not touch storage or Workflow',async()=>{
 const {load,env}=require('./recovery-fixture.cjs');
 const dispatch=load('src/lib/billing-notice-dispatch.ts',{
  './prisma':{prisma:new Proxy({},{get(){throw Error('Unexpected database access')}})},
  '../workflows/billing-notice':{},'workflow/api':{start:()=>{throw Error('Unexpected Workflow start')}},
 },env);
 assert.equal(await dispatch.dispatchBillingNotices(),0);
});
