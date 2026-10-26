const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {NextResponse}=require('next/server');
function load(file,stubs={},extra={}) {
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {module,exports:module.exports,Response,Request,URL,Date,console,process:{env:{}},...extra,require:n=>Object.hasOwn(stubs,n)?stubs[n]:require(n)});
 return module.exports;
}
const policy=load('src/lib/registration-trial-policy.ts');
const start=Date.parse('2026-10-26T12:00:00Z'),end=start+30*24*3600000;
test('each registration gets exactly 30 elapsed days, including across daylight-saving changes',()=>{
 for(const date of ['2026-10-26T12:00:00Z','2027-03-15T12:00:00Z']){
  const t=Date.parse(date),until=t+30*24*3600000;
  assert.equal(policy.registrationTrial(date,t).periodEnd,until/1000);
  assert.ok(policy.registrationTrial(date,until-1));
  assert.equal(policy.registrationTrial(date,until),null);
  assert.equal(policy.registrationTrial(date,until+1),null);
 }
});
test('missing, invalid and future creation times never grant access',()=>{
 for(const date of [undefined,'','not-a-date','2026-10-27T12:00:00Z']) assert.equal(policy.registrationTrial(date,start),null);
 assert.equal(policy.registrationTrial(new Date(start).toISOString(),NaN),null);
});
test('later registrations get their own full period; login or recovery cannot restart it',()=>{
 const old=policy.registrationTrial(new Date(start).toISOString(),start+10*86400000);
 const fresh=policy.registrationTrial(new Date(start+10*86400000).toISOString(),start+10*86400000);
 assert.equal(fresh.periodEnd-old.periodEnd,10*86400);
 assert.equal(policy.registrationTrial(new Date(start).toISOString(),end),null);
});
function trialFixture({enabled=true,disabled=false,broken=false}={}) {
 let calls=0;
 const creationTime=new Date(Date.now()-86400000).toISOString();
 const server=load('src/lib/registration-trial.ts',{'server-only':{},'./registration-trial-policy':policy,'./firebase-admin':{
  getAdminAuth:()=>({getUser:async uid=>{calls++;assert.equal(uid,'owner');if(broken)throw Error('provider down');return {disabled,metadata:{creationTime}};}})
 }},{process:{env:{TIME2PAY_REGISTRATION_TRIAL_ENABLED:enabled?'true':'false'}}});
 return {...server,calls:()=>calls};
}
test('server uses only Firebase Admin registration metadata and a distinct non-Stripe ledger period',async()=>{
 const f=trialFixture();const a=await f.getRegistrationTrial('owner'),b=await f.getRegistrationTrial('owner');
 assert.equal(a.subscriptionId,'trial:owner');assert.equal(a.starter,false);assert.equal(a.periodEnd-a.periodStart,30*86400);
 assert.equal(b.periodEnd,a.periodEnd);assert.equal(f.calls(),2);
});
test('disabled rollout, disabled account and Firebase errors fail closed',async()=>{
 const off=trialFixture({enabled:false});assert.equal(await off.getRegistrationTrial('owner'),null);assert.equal(off.calls(),0);
 assert.equal(await trialFixture({disabled:true}).getRegistrationTrial('owner'),null);
 assert.equal(await trialFixture({broken:true}).getRegistrationTrial('owner'),null);
});
test('paid limits remain intact; unpaid trials grant access and expired trials require a subscription',async()=>{
 let paid={subscriptionId:'sub_paid',starter:true},trial={subscriptionId:'trial:owner',starter:false},trialCalls=0;
 const access=load('src/lib/invoice-access.ts',{'server-only':{},'./billing':{getPaidEntitlement:async()=>paid},'./registration-trial':{getRegistrationTrial:async()=>{trialCalls++;return trial;}}});
 assert.equal((await access.getInvoiceEntitlement('owner')).subscriptionId,'sub_paid');assert.equal(trialCalls,0);
 paid=null;assert.equal(await access.hasInvoiceAccess('owner'),true);
 trial=null;assert.equal(await access.hasInvoiceAccess('owner'),false);
 paid={subscriptionId:'sub_paid',starter:true};assert.equal(await access.hasInvoiceAccess('owner'),true);
});
test('trial checkout is blocked before any Stripe call, customer creation or payment session',async()=>{
 const fail=new Proxy({}, {get(){throw Error('Payment side effect reached');}});
 const route=load('src/app/api/billing/checkout/route.ts',{
  'next/server':{NextResponse},'@/lib/auth':{requireUserOrUnauthorized:async()=>({uid:'owner'})},
  '@/lib/prisma':fail,'@/lib/billing':fail,'@/lib/billing-environment':fail,
  '@/lib/billing-plans':{isBillingPlan:v=>v==='starter'},'@/lib/registration-trial':{getRegistrationTrial:async()=>({periodEnd:end/1000})}
 });
 const response=await route.POST(new Request('https://preview.example/api/billing/checkout',{method:'POST',headers:{origin:'https://preview.example','content-type':'application/json'},body:JSON.stringify({plan:'starter'})}));
 assert.equal(response.status,409);assert.equal((await response.json()).code,'TRIAL_ACTIVE');
});
test('three launch calendar months are shared by old and new accounts, with an exact exclusive end',()=>{
 const launch='2026-10-26T12:00:00.000Z',until=Date.parse('2027-01-26T12:00:00.000Z');
 const registered='2026-08-01T12:00:00Z';
 assert.equal(policy.freeTrial(registered,launch,start-1),null);
 assert.equal(policy.freeTrial(registered,launch,start).periodEnd,until/1000);
 assert.ok(policy.freeTrial(registered,launch,until-1));
 assert.equal(policy.freeTrial(registered,launch,until),null);
});
test('a late signup receives at least 30 days; periods do not stack',()=>{
 const launch='2026-10-26T12:00:00.000Z';
 const early=policy.freeTrial('2026-11-01T12:00:00Z',launch,Date.parse('2026-11-01T12:00:00Z'));
 assert.equal(early.periodEnd,Date.parse('2027-01-26T12:00:00Z')/1000);
 const lateDate=Date.parse('2027-01-25T12:00:00Z'),late=policy.freeTrial(new Date(lateDate).toISOString(),launch,lateDate);
 assert.equal(late.periodEnd,(lateDate+30*86400000)/1000);
 const after=Date.parse('2027-02-01T12:00:00Z');
 assert.equal(policy.freeTrial(new Date(after).toISOString(),launch,after).periodEnd,(after+30*86400000)/1000);
});
test('month-end clamping, leap years and invalid launch settings are safe',()=>{
 for(const [a,b] of [['2026-01-31T12:00:00.000Z','2026-04-30T12:00:00.000Z'],['2027-11-30T12:00:00.000Z','2028-02-29T12:00:00.000Z'],['2026-11-30T12:00:00.000Z','2027-02-28T12:00:00.000Z']]){
  assert.equal(policy.launchTrialPeriod(a).periodEnd,Date.parse(b)/1000);
 }
 for(const a of [undefined,'','invalid','2026-02-30T00:00:00.000Z','2026-10-26','2026-10-26T12:00:00Z']) assert.equal(policy.launchTrialPeriod(a),null);
 const creation=new Date(start).toISOString();
 assert.equal(policy.freeTrial(creation,'invalid',start).periodEnd,end/1000);
 assert.equal(policy.freeTrial(undefined,'2026-10-26T12:00:00.000Z',start),null);
 assert.equal(policy.freeTrial('2026-10-27T12:00:00Z','2026-10-26T12:00:00.000Z',start),null);
});

test('launch timestamps with milliseconds keep issue ledger timestamps integral without starting early',()=>{
 const launch='2026-10-26T12:00:00.123Z',old='2026-08-01T00:00:00Z';
 assert.equal(policy.freeTrial(old,launch,start+122),null);
 const period=policy.freeTrial(old,launch,start+123);
 assert.ok(period);assert.ok(Number.isInteger(period.periodStart));assert.ok(Number.isInteger(period.periodEnd));
 assert.equal(policy.freeTrial(old,launch,Date.parse('2027-01-26T12:00:00.123Z')),null);
});
