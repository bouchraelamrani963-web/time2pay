const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const moduleQa={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/isolated-qa.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleQa,exports:moduleQa.exports,URL,Date,Error});
const {assertIsolatedQa,isolatedQaCredential}=moduleQa.exports;
const now=Date.parse('2026-11-04T11:00:00Z');
const env={TIME2PAY_ISOLATED_QA:'true',NEXT_PUBLIC_TIME2PAY_ISOLATED_QA:'true',FIREBASE_PROJECT_ID:'time2pay-isolated-qa-20261030',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'time2pay-isolated-qa-20261030',TIME2PAY_TOTP_TEST_PROJECT_ID:'time2pay-isolated-qa-20261030',TIME2PAY_REQUIRE_TOTP:'true',TIME2PAY_TOTP_SETUP_ENABLED:'true',TIME2PAY_CONFIGURE_TEST_TOTP:'false',TIME2PAY_REGISTRATION_TRIAL_ENABLED:'true',TIME2PAY_LIVE_PAYMENTS_ENABLED:'false',TIME2PAY_RECOVERY_ENABLED:'false',TIME2PAY_SECURITY_NOTICES_ENABLED:'false',DATABASE_URL:'postgresql://qa_runner:synthetic@127.0.0.1:55432/time2pay_auth_qa',DIRECT_URL:'postgresql://qa_runner:synthetic@127.0.0.1:55432/time2pay_auth_qa',TIME2PAY_QA_ACCESS_TOKEN:'synthetic-not-a-token',TIME2PAY_QA_ACCESS_TOKEN_EXPIRES_AT:new Date(now+1800000).toISOString()};
test('disabled QA profile leaves release configuration untouched',()=>assert.equal(assertIsolatedQa({}),null));
test('complete isolated local QA config passes without a private key',()=>assert.equal(assertIsolatedQa(env,now,true).projectId,env.FIREBASE_PROJECT_ID));
test('production, hosted deployment, wrong Firebase binding and missing MFA fail closed',()=>{
 for(const change of [{VERCEL_ENV:'production'},{VERCEL_PROJECT_ID:'any-hosted-project'},{FIREBASE_PROJECT_ID:'time2pay-c5c5c'},{NEXT_PUBLIC_FIREBASE_PROJECT_ID:'time2pay-c5c5c'},{TIME2PAY_TOTP_TEST_PROJECT_ID:'other'},{TIME2PAY_REQUIRE_TOTP:'false'},{TIME2PAY_TOTP_SETUP_ENABLED:'false'},{NEXT_PUBLIC_TIME2PAY_ISOLATED_QA:'false'},{TIME2PAY_CONFIGURE_TEST_TOTP:'true'}])assert.throws(()=>assertIsolatedQa({...env,...change},now,true));
});
test('remote or differently named database, query-string injection and production credentials rejected',()=>{
 for(const url of ['postgresql://qa_runner:x@production.invalid:55432/time2pay_auth_qa','postgresql://qa_runner:x@localhost:55432/neondb','postgresql://qa_runner:x@localhost:5432/time2pay_auth_qa','postgresql://owner:x@localhost:55432/time2pay_auth_qa',env.DATABASE_URL+'?host=production.invalid'])for(const key of ['DATABASE_URL','DIRECT_URL'])assert.throws(()=>assertIsolatedQa({...env,[key]:url},now,true));
});
test('all payment/customer-mail secrets, emulators and long-lived Admin credentials rejected',()=>{
 for(const key of ['STRIPE_SECRET_KEY','STRIPE_TEST_RESTRICTED_KEY','RESEND_API_KEY','RESEND_TEST_API_KEY','FIREBASE_PRIVATE_KEY','FIREBASE_PRIVATE_KEY_BASE64','FIREBASE_TEST_SERVICE_ACCOUNT_JSON','GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_AUTH_EMULATOR_HOST','INVOICE_FROM_EMAIL','TIME2PAY_EMAIL_MODE','TIME2PAY_BILLING_MODE'])assert.throws(()=>assertIsolatedQa({...env,[key]:'synthetic'},now,true));
 for(const key of ['TIME2PAY_LIVE_PAYMENTS_ENABLED','TIME2PAY_RECOVERY_ENABLED','TIME2PAY_SECURITY_NOTICES_ENABLED'])assert.throws(()=>assertIsolatedQa({...env,[key]:'true'},now,true));
});
test('missing, invalid, expired and over-one-hour token expiry rejected',()=>{
 for(const expires of ['', 'invalid',new Date(now).toISOString(),new Date(now+3600001).toISOString()])assert.throws(()=>assertIsolatedQa({...env,TIME2PAY_QA_ACCESS_TOKEN_EXPIRES_AT:expires},now,true));
 assert.throws(()=>assertIsolatedQa({...env,TIME2PAY_QA_ACCESS_TOKEN:''},now,true));
});
test('credential never refreshes and stops returning token on expiry',async()=>{
 let clock=now;const credential=isolatedQaCredential(env,()=>clock);
 const result=await credential.getAccessToken();assert.equal(result.expires_in,1800);assert.equal(result.access_token,'synthetic-not-a-token');
 clock+=1800000;await assert.rejects(()=>credential.getAccessToken(),/configuration rejected/);
});
function loadTs(file,stubs={},configuration=env){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Date:{now:()=>now,parse:Date.parse},URL,Error,Buffer,process:{env:configuration},require:n=>Object.hasOwn(stubs,n)?stubs[n]:n==="server-only"?{}:require(n)});return module.exports;}
test('Admin initializes only the fixed QA project with a named keyless credential',()=>{
 let options,name;
 const admin=loadTs('src/lib/firebase-admin.ts',{'server-only':{},'./isolated-qa':{assertIsolatedQa,isolatedQaCredential:(env)=>isolatedQaCredential(env,()=>now)},'firebase-admin/app':{cert:()=>{throw Error('Private key path reached')},getApps:()=>[],initializeApp:(o,n)=>{options=o;name=n;return{o,n}}},'firebase-admin/auth':{getAuth:app=>({app})}});
 assert.deepEqual(admin.getMissingFirebaseAdminEnv().length,0);admin.getAdminAuth();
 assert.equal(options.projectId,env.FIREBASE_PROJECT_ID);assert.equal(typeof options.credential.getAccessToken,'function');assert.equal(name,'time2pay-pr22-keyless-qa');
});
test('customer email and billing are blocked even before missing provider configuration is consulted',()=>{
 const billing=loadTs('src/lib/billing-environment.ts',{'./billing-plans':{BILLING_PLANS:{}}});assert.throws(()=>billing.getBillingEnvironment(),/Payments disabled/);
 const email=loadTs('src/lib/email.ts',{resend:{Resend:class{constructor(){throw Error('Resend reached')}}}});assert.throws(()=>email.getInvoiceEmailConfig(),/Customer communication disabled/);
});
test('provider preflight is read-only, fixed-project and outputs no access token or email',async()=>{
 const calls=[];const token='synthetic-not-a-token';
 const {preflight}=require('../qa/preflight.cjs');
 const result=await preflight(token,async(url,options)=>{calls.push({url,method:options.method??'GET'});return{ok:true,json:async()=>url.includes('/admin/v2/')?{name:'projects/time2pay-isolated-qa-20261030/config',signIn:{email:{enabled:true}},mfa:{providerConfigs:[{state:'ENABLED',totpProviderConfig:{adjacentIntervals:0}}]}}:{users:[]}}});
 assert.ok(calls.every(c=>c.method==='GET'&&c.url.includes('time2pay-isolated-qa-20261030')));assert.equal(result.userListEmpty,true);assert.equal(result.totpEnabled,true);assert.ok(!JSON.stringify(result).includes(token));
 await assert.rejects(()=>preflight(token,async()=>({ok:true,json:async()=>({name:'projects/production/config'})})),/QA_PROJECT_MISMATCH/);
});
