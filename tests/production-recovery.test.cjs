const test=require('node:test'),assert=require('node:assert/strict');
const {load,env}=require('./recovery-fixture.cjs');
const {productionRecoveryEnv:production}=require('./production-recovery-fixture.cjs');
const file='src/lib/recovery-config.ts';
test('production recovery is a separate opt-in and cannot activate from copied Preview flags',()=>{
 assert.equal(load(file,{},{}).recoveryEnabled(),false);
 assert.equal(load(file,{},{...env,VERCEL_ENV:'production'}).recoveryEnabled(),false);
 const policy=load(file,{},production);
 assert.equal(policy.productionRecoveryEnabled(),true);assert.equal(policy.previewRecoveryEnabled(),false);assert.equal(policy.recoveryEnabled(),true);
 assert.equal(load(file,{},{...production,VERCEL_ENV:'preview'}).recoveryEnabled(),false);
 for(const setting of ['TIME2PAY_RECOVERY_ENABLED','TIME2PAY_REQUIRE_TOTP','TIME2PAY_TOTP_SETUP_ENABLED','TIME2PAY_SECURITY_NOTICES_ENABLED']){
  for(const value of [undefined,'false','TRUE','1'])assert.equal(load(file,{},{...production,[setting]:value}).recoveryEnabled(),false,setting+':'+value);
 }
});
test('production denies mixed projects/databases, absent secrets, insecure connections and test credentials',()=>{
 const missing=['TIME2PAY_RECOVERY_DATABASE_ID','FIREBASE_PROJECT_ID','NEXT_PUBLIC_FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY_BASE64','NEXT_PUBLIC_FIREBASE_API_KEY','DATABASE_URL','DIRECT_URL','TIME2PAY_RECOVERY_HASH_SECRET','CRON_SECRET','RESEND_API_KEY','INVOICE_FROM_EMAIL'];
 for(const key of missing)assert.equal(load(file,{},{...production,[key]:undefined}).recoveryEnabled(),false,key);
 for(const change of [
  {TIME2PAY_RECOVERY_DATABASE_ID:'time2pay-stripe-test'},
  {FIREBASE_PROJECT_ID:'time2pay-preview',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'time2pay-preview'},
  {NEXT_PUBLIC_FIREBASE_PROJECT_ID:'foreign'},{FIREBASE_CLIENT_EMAIL:'foreign@example.invalid'},
  {DATABASE_URL:env.DATABASE_URL},{DIRECT_URL:env.DIRECT_URL},
  {DIRECT_URL:production.DIRECT_URL.replace('/neondb','/other')},
  {DIRECT_URL:production.DIRECT_URL.replace('?sslmode=require','')},
  {DIRECT_URL:production.DIRECT_URL.replace('postgresql:','http:')},
  {TIME2PAY_TOTP_TEST_PROJECT_ID:'time2pay-preview'},{FIREBASE_TEST_SERVICE_ACCOUNT_JSON:'{}'},
  {TIME2PAY_RECOVERY_HASH_SECRET:'short'},{CRON_SECRET:'short'},
  {CRON_SECRET:production.TIME2PAY_RECOVERY_HASH_SECRET},{TIME2PAY_EMAIL_MODE:'test'},
  {RESEND_TEST_API_KEY:'synthetic'},{TIME2PAY_RECOVERY_PREVIEW_RETRY_PROBE:'true'}
 ])assert.equal(load(file,{},{...production,...change}).recoveryEnabled(),false,JSON.stringify(Object.keys(change)));
});
test('fully configured production cannot expose the synthetic notice probe',async()=>{
 const {NextRequest}=require('next/server');
 const fail=new Proxy({}, {get(){throw Error('Probe reached protected side effects');}});
 const route=load('src/app/api/auth/recovery/notice-check/route.ts',{
  '@/lib/auth':fail,'@/lib/account-recovery':fail,'@/lib/prisma':fail,
  '@/lib/recovery-http':{recoveryJson:(body,status=200)=>Response.json(body,{status})},
 },production);
 assert.equal((await route.POST(new NextRequest('https://time2pay.nl/api/auth/recovery/notice-check',{method:'POST'}))).status,404);
 assert.equal((await route.GET(new NextRequest('https://time2pay.nl/api/auth/recovery/notice-check?id=synthetic'))).status,404);
});
test('production retains signed TOTP and recovery-lock enforcement when recovery is disabled',()=>{
 const {identity,token}=require('./recovery-fixture.cjs');
 const policy=load('src/lib/auth-policy.ts',{},production),account=identity(),valid=token();
 assert.equal(policy.getMfaConfiguration().required,true);assert.equal(policy.getMfaConfiguration().setupEnabled,true);
 assert.equal(policy.mfaAccessError(valid,account),null);
 assert.equal(policy.mfaAccessError({...valid,firebase:{...valid.firebase,sign_in_second_factor:undefined}},account),'mfa_required');
 assert.equal(policy.mfaAccessError(valid,{...account,customClaims:{time2payRecoveryLocked:true}},false),'recovery_required');
});
test('production database recovery locks survive disabled or broken configuration even before Firebase lock propagation',async()=>{
 const {identity,token}=require('./recovery-fixture.cjs');
 for(const change of [{TIME2PAY_RECOVERY_ENABLED:'false'},{TIME2PAY_RECOVERY_HASH_SECRET:''},{TIME2PAY_SECURITY_NOTICES_ENABLED:'false'}]){
  let reads=0;const user=identity();
  const core=load('src/lib/account-recovery.ts',{
   './prisma':{prisma:{accountRecovery:{findUnique:async({where})=>{reads++;assert.equal(where.userId,user.uid);return {status:'RESETTING'};}}}},
   './firebase-admin':{},
  },{...production,...change});
  assert.equal(await core.recoveryLocked(user.uid),true);assert.equal(reads,1);
  await assert.rejects(()=>core.exchangeRecoverySession(token(),user),e=>e.code==='recovery_unavailable');
 }
});
test('production missing lock table fails closed instead of silently granting a normal session',async()=>{
 const core=load('src/lib/account-recovery.ts',{
  './prisma':{prisma:{accountRecovery:{findUnique:async()=>{throw Error('table unavailable');}}}},'./firebase-admin':{},
 },{...production,TIME2PAY_RECOVERY_ENABLED:'false'});
 await assert.rejects(()=>core.recoveryLocked('synthetic'));
});
test('production worker never invokes Preview transport fault injection',async()=>{
 let sent=0;const notice={id:'synthetic',email:'recipient@example.invalid',kind:'PREVIEW_RETRY_CHECK',attempts:1,
  createdAt:new Date(),nextAttemptAt:new Date(),leaseUntil:null,sentAt:null,failedAt:null};
 const worker=load('src/lib/security-notice-worker.ts',{
  './prisma':{prisma:{securityNotice:{updateMany:async()=>({count:1}),findUnique:async()=>notice}}},
  './email':{getInvoiceEmailConfig:()=>({from:'sender@example.invalid',resend:{key:'synthetic'}})},
  fetch:async()=>{sent++;return {ok:true,json:async()=>({id:'synthetic-provider-id'})};},
 },production);
 assert.equal((await worker.attemptSecurityNotice(notice.id)).done,true);assert.equal(sent,1);
});
test('Production always requires TOTP even if its enforcement flag is absent or false',()=>{
 const {identity,token}=require('./recovery-fixture.cjs');
 for(const value of [undefined,'false','TRUE','1']){
  const policy=load('src/lib/auth-policy.ts',{},{...production,TIME2PAY_REQUIRE_TOTP:value});
  assert.equal(policy.getMfaConfiguration().required,true);
  assert.equal(policy.mfaAccessError(token(),{...identity(),multiFactor:{enrolledFactors:[]}}),'mfa_setup_required');
 }
});
test('Production Firebase Admin refuses copied or mismatched test identities before initialization',()=>{
 let initialized=0;
 const stubs={'firebase-admin/app':{getApps:()=>[],initializeApp:()=>{initialized++;return {};},cert:v=>v},'firebase-admin/auth':{getAuth:()=>({synthetic:true})}};
 for(const change of [{FIREBASE_PROJECT_ID:'time2pay-preview'},{NEXT_PUBLIC_FIREBASE_PROJECT_ID:'time2pay-preview'},
  {FIREBASE_CLIENT_EMAIL:'synthetic@time2pay-preview.iam.gserviceaccount.com'},
  {TIME2PAY_TOTP_TEST_PROJECT_ID:'time2pay-preview'},{FIREBASE_TEST_SERVICE_ACCOUNT_JSON:'{}'}]){
  assert.throws(()=>load('src/lib/firebase-admin.ts',stubs,{...production,...change}).getAdminAuth());
 }
 assert.equal(initialized,0);
 assert.equal(load('src/lib/firebase-admin.ts',stubs,production).getAdminAuth().synthetic,true);assert.equal(initialized,1);
});
