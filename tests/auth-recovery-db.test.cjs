const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {load,identity,token,env}=require('./recovery-fixture.cjs');
const enabled=process.env.TIME2PAY_RECOVERY_DB_TEST==='true';
let prisma;
test.before(async()=>{if(!enabled)return;
 const url=new URL(process.env.DATABASE_URL);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.equal(url.pathname,'/time2pay_recovery_ci');
 prisma=new(require('@prisma/client').PrismaClient)();await prisma.$connect();
});
test.after(async()=>{if(prisma)await prisma.$disconnect();});
function fixture(options={}){
 const uid='qa-'+randomUUID(),calls=[];
 let user=identity(uid);
 const admin={getUser:async id=>{assert.equal(id,uid);return user;},
  setCustomUserClaims:async(id,claims)=>{assert.equal(id,uid);calls.push('claims');user={...user,customClaims:claims};},
  revokeRefreshTokens:async id=>{assert.equal(id,uid);calls.push('revoke');},
  updateUser:async(id,data)=>{assert.equal(id,uid);calls.push('clear');if(options.failClear)throw Error('Simulated Firebase failure');user={...user,multiFactor:data.multiFactor};return user;}};
 const core=load('src/lib/account-recovery.ts',{'./prisma':{prisma},'./firebase-admin':{getAdminAuth:()=>admin},
  './email':{getInvoiceEmailConfig:()=>({from:'test@invalid.example',testRecipient:'delivered@resend.dev',resend:{emails:{send:async message=>{assert.equal(message.to,'delivered@resend.dev');assert.ok(!/[A-F0-9]{4}(?:-[A-F0-9]{4}){7}/.test(message.text));return {error:null};}}}})}});
 return {uid,core,calls,user:()=>user,newFactor:()=>{user={...user,multiFactor:{enrolledFactors:[{factorId:'totp',uid:'new-factor'}]}};}};
}
async function initial(f){const result=await f.core.exchangeRecoverySession(token(f.uid),f.user());assert.equal(result.recoveryCodes.length,10);return result.recoveryCodes;}
test('PostgreSQL: initial codes are issued once; database contains only scoped hashes',{skip:!enabled},async()=>{
 const f=fixture(),codes=await initial(f);
 assert.equal((await f.core.exchangeRecoverySession(token(f.uid),f.user())).recoveryCodes,undefined);
 const rows=await prisma.recoveryCode.findMany({where:{userId:f.uid}});
 assert.equal(rows.length,10);assert.ok(rows.every(r=>r.codeHash.length===64));assert.ok(!JSON.stringify(rows).includes(codes[0]));
});
test('PostgreSQL: simultaneous reuse of one code yields exactly one reset and one revocation',{skip:!enabled},async()=>{
 const f=fixture(),codes=await initial(f);
 const results=await Promise.allSettled(Array.from({length:8},()=>f.core.beginRecovery(f.user(),codes[0])));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(f.calls.filter(v=>v==='revoke').length,1);
 assert.equal(await prisma.recoveryCode.count({where:{userId:f.uid,usedAt:{not:null}}}),1);
 assert.equal((await prisma.accountRecovery.findUnique({where:{userId:f.uid}})).status,'ENROLLMENT_REQUIRED');
});
test('PostgreSQL: old sessions stay blocked; only a matching grant plus new TOTP completes and rotates codes',{skip:!enabled},async()=>{
 const f=fixture(),codes=await initial(f),grant=await f.core.beginRecovery(f.user(),codes[0]);
 assert.equal(await f.core.recoveryLocked(f.uid),true);
 await prisma.accountRecovery.update({where:{userId:f.uid},data:{startedAt:new Date(Date.now()-10000)}});
 f.newFactor();
 await assert.rejects(()=>f.core.exchangeRecoverySession(token(f.uid,'new-factor'),f.user(),'wrong-grant'));
 await assert.rejects(()=>f.core.exchangeRecoverySession(token(f.uid,'old-factor'),f.user(),grant));
 const completed=await f.core.exchangeRecoverySession(token(f.uid,'new-factor'),f.user(),grant);
 assert.equal(completed.recoveryCodes.length,10);assert.equal(completed.recovered,true);
 assert.equal(await f.core.recoveryLocked(f.uid),false);assert.equal(f.user().customClaims.unrelated,'preserved');
 assert.ok(!f.user().customClaims.time2payRecoveryLocked);
 await assert.rejects(()=>f.core.beginRecovery(f.user(),codes[1]));
 assert.equal((await f.core.exchangeRecoverySession(token(f.uid,'new-factor'),f.user())).recoveryCodes,undefined);
});
test('PostgreSQL: expiry never unlocks access; an unused code can restart interrupted recovery',{skip:!enabled},async()=>{
 const f=fixture(),codes=await initial(f),grant=await f.core.beginRecovery(f.user(),codes[0]);
 f.newFactor();await prisma.accountRecovery.update({where:{userId:f.uid},data:{expiresAt:new Date(0)}});
 await assert.rejects(()=>f.core.exchangeRecoverySession(token(f.uid,'new-factor'),f.user(),grant));
 assert.equal(await f.core.recoveryLocked(f.uid),true);
 const replacement=await f.core.beginRecovery(f.user(),codes[1]);assert.notEqual(replacement,grant);
 assert.equal(await prisma.recoveryCode.count({where:{userId:f.uid,usedAt:{not:null}}}),2);
});
test('PostgreSQL: invalid codes and cross-account codes never call Firebase mutations',{skip:!enabled},async()=>{
 const a=fixture(),b=fixture(),codes=await initial(a);await initial(b);
 await assert.rejects(()=>a.core.beginRecovery(a.user(),'AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA'));
 await assert.rejects(()=>b.core.beginRecovery(b.user(),codes[0]));
 assert.equal(a.calls.length,0);assert.equal(b.calls.length,0);
});
test('PostgreSQL: distributed rate attempts serialize and block beyond the account limit',{skip:!enabled},async()=>{
 const f=fixture();
 const results=await Promise.allSettled(Array.from({length:12},()=>f.core.takeRecoveryRate('ci-limit',f.uid,5,900)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,5);
 assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===429));
});
test('PostgreSQL: support intake logs a request but cannot change factors or grant a session',{skip:!enabled},async()=>{
 const f=fixture();const reference=await f.core.submitRecoverySupport(f.user(),'test@invalid.example','Synthetic lost-device test');
 assert.ok(reference);assert.equal(f.calls.length,0);assert.equal(f.user().multiFactor.enrolledFactors[0].uid,'old-factor');
 assert.equal((await prisma.recoverySupportRequest.findUnique({where:{id:reference}})).status,'REVIEW_REQUIRED');
});

test('PostgreSQL: Firebase reset failure leaves a durable application and provider recovery lock',{skip:!enabled},async()=>{
 const f=fixture({failClear:true}),codes=await initial(f);
 await assert.rejects(()=>f.core.beginRecovery(f.user(),codes[0]));
 assert.equal(await f.core.recoveryLocked(f.uid),true);
 assert.equal(f.user().customClaims.time2payRecoveryLocked,true);
 assert.equal((await prisma.accountRecovery.findUnique({where:{userId:f.uid}})).status,'RESETTING');
 assert.equal(await prisma.recoveryCode.count({where:{userId:f.uid,usedAt:{not:null}}}),1);
 assert.equal(f.user().multiFactor.enrolledFactors[0].uid,'old-factor');
});

test('PostgreSQL: concurrent notice workers accept a single lease and retain durable acceptance evidence',{skip:!enabled},async()=>{
 const notice=await prisma.securityNotice.create({data:{userId:'qa-notice-'+randomUUID(),email:'private@invalid.example',kind:'RECOVERY_STARTED'}});
 let calls=0;
 const worker=load('src/lib/security-notice-worker.ts',{'./prisma':{prisma},
  './email':{getInvoiceEmailConfig:()=>({resend:{key:'synthetic'},from:'test@invalid.example',testRecipient:'delivered@resend.dev'})},
  fetch:async(url,req)=>{calls++;assert.deepEqual(JSON.parse(req.body).to,['delivered@resend.dev']);return {ok:true,json:async()=>({id:'synthetic-provider-id'})};}},
  {...env,TIME2PAY_SECURITY_NOTICES_ENABLED:'true'});
 await Promise.all(Array.from({length:12},()=>worker.attemptSecurityNotice(notice.id)));
 assert.equal(calls,1);const stored=await prisma.securityNotice.findUnique({where:{id:notice.id}});
 assert.equal(stored.attempts,1);assert.ok(stored.sentAt);assert.equal(stored.providerId,'synthetic-provider-id');
});
test('PostgreSQL: real advisory locks admit exactly 30 Starter issues and preserve repeat/period behavior',{skip:!enabled},async()=>{
 const userId='qa-quota-'+randomUUID();
 const client=await prisma.client.create({data:{userId,name:'Synthetic quota client'}});
 const invoices=await Promise.all(Array.from({length:32},()=>prisma.invoice.create({data:{userId,clientId:client.id,number:'CI-'+randomUUID(),dueDate:new Date()}})));
 let entitlement={starter:true,subscriptionId:'sub_fixture',periodStart:100,periodEnd:200};
 const {NextResponse}=require('next/server');
 const module=load('src/lib/invoice-issuance.ts',{'./prisma':{prisma},'./billing':{
  getPaidEntitlement:async()=>entitlement,paymentRequired:()=>NextResponse.json({code:'SUBSCRIPTION_REQUIRED'},{status:402})}});
 const results=await Promise.all(invoices.slice(0,31).map(i=>module.authorizeInvoiceIssue(userId,i.id)));
 assert.equal(results.filter(r=>r===null).length,30);assert.equal(results.filter(r=>r?.status===409).length,1);
 const issued=await prisma.invoiceIssue.findFirst({where:{userId}});
 assert.equal(await module.authorizeInvoiceIssue(userId,issued.invoiceId),null);
 assert.equal(await prisma.invoiceIssue.count({where:{userId}}),30);
 entitlement={...entitlement,periodStart:200,periodEnd:300};
 assert.equal(await module.authorizeInvoiceIssue(userId,invoices[31].id),null);
 entitlement=null;assert.equal((await module.authorizeInvoiceIssue(userId,issued.invoiceId)).status,402);
});
