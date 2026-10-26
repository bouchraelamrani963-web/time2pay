const test=require('node:test'),assert=require('node:assert/strict');
const {load,env}=require('./recovery-fixture.cjs');
const configured={...env,TIME2PAY_SECURITY_NOTICES_ENABLED:'true'};
function fixture(provider){
 const notice={id:'opaque-notice',userId:'synthetic',email:'private@example.invalid',kind:'RECOVERY_STARTED',createdAt:new Date(),
  attempts:0,firstAttemptAt:null,nextAttemptAt:new Date(0),leaseUntil:null,leaseToken:null,sentAt:null,failedAt:null};
 let sent=0;const requests=[];
 const db={findUnique:async()=>({...notice}),updateMany:async({where,data})=>{
  if(where.leaseToken&&where.leaseToken!==notice.leaseToken)return {count:0};
  if(where.attempts!==undefined&&where.attempts!==notice.attempts)return {count:0};
  if(Object.hasOwn(where,'firstAttemptAt')&&where.firstAttemptAt!==notice.firstAttemptAt)return {count:0};
  if(Object.hasOwn(where,'sentAt')&&(notice.sentAt||notice.failedAt))return {count:0};
  if(where.nextAttemptAt&&notice.nextAttemptAt>where.nextAttemptAt.lte)return {count:0};
  if(where.OR&&notice.leaseUntil&&notice.leaseUntil>where.OR[1].leaseUntil.lte)return {count:0};
  for(const[k,v]of Object.entries(data))notice[k]=v&&typeof v==='object'&&'increment'in v?notice[k]+v.increment:v;
  return {count:1};}};
 const worker=load('src/lib/security-notice-worker.ts',{'./prisma':{prisma:{securityNotice:db}},
  './email':{getInvoiceEmailConfig:()=>({from:'test@invalid.example',testRecipient:'delivered@resend.dev',resend:{key:'synthetic-test-key'}})},
  fetch:async(url,request)=>{sent++;requests.push({url,request});return provider?provider():{ok:true,json:async()=>({id:'provider-id'})};}},configured);
 return {notice,requests,worker,sent:()=>sent};
}
test('notice failure remains queued; retry preserves its idempotency key and records provider acceptance',async()=>{
 let fail=true;const f=fixture(()=>fail?Promise.reject(Error('Sensitive provider detail')):{ok:true,json:async()=>({id:'accepted'})});
 const first=await f.worker.attemptSecurityNotice(f.notice.id);
 assert.equal(first.done,false);assert.equal(f.notice.attempts,1);assert.equal(f.notice.sentAt,null);
 assert.equal(f.notice.lastErrorCode,'delivery_failed');assert.ok(new Date(first.retryAt)>new Date());
 assert.ok(!JSON.stringify(f.notice).includes('Sensitive provider'));
 fail=false;f.notice.nextAttemptAt=new Date(0);assert.equal((await f.worker.attemptSecurityNotice(f.notice.id)).done,true);
 assert.ok(f.notice.sentAt);assert.equal(f.notice.providerId,'accepted');
 assert.equal(f.requests[0].request.headers['Idempotency-Key'],f.requests[1].request.headers['Idempotency-Key']);
 for(const r of f.requests){assert.equal(r.url,'https://api.resend.com/emails');assert.deepEqual(JSON.parse(r.request.body).to,['delivered@resend.dev']);assert.ok(!r.request.body.includes(f.notice.email));}
 await f.worker.attemptSecurityNotice(f.notice.id);assert.equal(f.sent(),2);
});
test('concurrent notice workers share one send lease',async()=>{
 const f=fixture();await Promise.all(Array.from({length:12},()=>f.worker.attemptSecurityNotice(f.notice.id)));
 assert.equal(f.sent(),1);assert.equal(f.notice.attempts,1);
});
test('exhausted and expired notices stop safely and remain available for manual review',async()=>{
 const f=fixture(()=>Promise.reject(Error('Unavailable')));f.notice.attempts=6;
 assert.equal((await f.worker.attemptSecurityNotice(f.notice.id)).done,true);assert.ok(f.notice.failedAt);assert.equal(f.sent(),1);
 const old=fixture();old.notice.createdAt=new Date(Date.now()-24*3600000);
 old.notice.firstAttemptAt=old.notice.createdAt;old.notice.attempts=1;
 assert.equal((await old.worker.attemptSecurityNotice(old.notice.id)).done,true);assert.ok(old.notice.failedAt);assert.equal(old.sent(),0);
});
test('a notice waiting more than a daily sweep interval still gets its first send and retry window',async()=>{
 let fail=true;const f=fixture(()=>fail?Promise.reject(Error('Unavailable')):{ok:true,json:async()=>({id:'accepted'})});
 const eventDate=new Date(Date.now()-25*3600000);f.notice.createdAt=eventDate;
 const first=await f.worker.attemptSecurityNotice(f.notice.id);
 assert.equal(first.done,false);assert.equal(f.sent(),1);assert.equal(f.notice.failedAt,null);
 assert.ok(f.notice.firstAttemptAt>eventDate);const start=f.notice.firstAttemptAt;
 fail=false;f.notice.nextAttemptAt=new Date(0);await f.worker.attemptSecurityNotice(f.notice.id);
 assert.equal(f.notice.firstAttemptAt,start);assert.ok(f.notice.sentAt);
 assert.equal(f.requests[0].request.headers['Idempotency-Key'],f.requests[1].request.headers['Idempotency-Key']);
 assert.ok(JSON.parse(f.requests[1].request.body).text.includes(eventDate.toISOString()));
});
test('an ambiguous legacy attempt without a start timestamp cannot reopen an expired send window',async()=>{
 const f=fixture();f.notice.createdAt=new Date(Date.now()-25*3600000);f.notice.attempts=1;
 await f.worker.attemptSecurityNotice(f.notice.id);
 assert.equal(f.sent(),0);assert.ok(f.notice.failedAt);assert.equal(f.notice.lastErrorCode,'delivery_window_expired');
});
test('crashed worker lease expires before the same idempotent notice is sent again',async()=>{
 const f=fixture();f.notice.leaseUntil=new Date(Date.now()+60000);f.notice.leaseToken='crashed';
 assert.equal((await f.worker.attemptSecurityNotice(f.notice.id)).done,false);assert.equal(f.sent(),0);
 f.notice.leaseUntil=new Date(0);await f.worker.attemptSecurityNotice(f.notice.id);assert.equal(f.sent(),1);
});
test('durable workflow sleeps until the stored retry date without serializing account secrets',async()=>{
 let attempts=0;const sleeps=[];
 const flow=load('src/workflows/security-notice.ts',{'workflow':{sleep:async date=>sleeps.push(date.toISOString())},
  '../lib/security-notice-worker':{attemptSecurityNotice:async id=>{assert.equal(id,'opaque');return ++attempts===1?{done:false,retryAt:'2026-10-24T20:00:00.000Z'}:{done:true};}}});
 await flow.securityNoticeWorkflow('opaque');assert.equal(attempts,2);assert.deepEqual(sleeps,['2026-10-24T20:00:00.000Z']);
});
test('internal sweep requires a strong server bearer secret',async()=>{
 let calls=0;const route=load('src/app/api/internal/security-notices/route.ts',{
  '@/lib/security-notice-dispatch':{dispatchSecurityNotices:async()=>{calls++;return 1;}}},{...configured,CRON_SECRET:'s'.repeat(40)});
 for(const header of ['', 'Bearer wrong'])assert.equal((await route.GET(new Request('https://preview.example/api/internal/security-notices',{headers:{authorization:header}}))).status,401);
 assert.equal(calls,0);assert.equal((await route.GET(new Request('https://preview.example/api/internal/security-notices',{headers:{authorization:'Bearer '+'s'.repeat(40)}}))).status,200);assert.equal(calls,1);
});

test('isolated Preview fault injection fails once, then sends the synthetic notice through the real transport boundary',async()=>{
 const f=fixture();f.notice.kind='PREVIEW_RETRY_CHECK';
 const first=await f.worker.attemptSecurityNotice(f.notice.id);
 assert.equal(first.done,false);assert.equal(f.notice.attempts,1);assert.equal(f.sent(),0);assert.equal(f.notice.lastErrorCode,'delivery_failed');
 f.notice.nextAttemptAt=new Date(0);await f.worker.attemptSecurityNotice(f.notice.id);
 assert.equal(f.notice.attempts,2);assert.equal(f.sent(),1);assert.ok(f.notice.sentAt);
});
