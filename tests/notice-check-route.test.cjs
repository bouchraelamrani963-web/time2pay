const test=require('node:test'),assert=require('node:assert/strict');
const {load,env}=require('./recovery-fixture.cjs');
const {NextRequest}=require('next/server');
const path='src/app/api/auth/recovery/notice-check/route.ts';
const configured={...env,TIME2PAY_SECURITY_NOTICES_ENABLED:'true'};
function setup(user,config=configured){let created=0,dispatched=0;const lookups=[];
 const route=load(path,{'@/lib/auth':{requireUserOrUnauthorized:async()=>user},
  '@/lib/recovery-http':{readRecoveryBody:async()=>({}),recoveryJson:(body,status=200)=>Response.json(body,{status}),recoveryFailure:()=>Response.json({error:'denied'},{status:403})},
  '@/lib/account-recovery':{takeRecoveryRate:async()=>{},deliverSecurityNotices:async uid=>{assert.equal(uid,'owner');dispatched++;}},
  '@/lib/prisma':{prisma:{securityNotice:{create:async({data})=>{assert.deepEqual(JSON.parse(JSON.stringify(data)),{userId:'owner',email:'delivered@resend.dev',kind:'PREVIEW_RETRY_CHECK'});created++;return{id:'opaque'};},findFirst:async query=>{lookups.push(query);return null;}}}}},config);
 return {route,counts:()=>({created,dispatched}),lookups};}
test('notice probe is absent outside explicitly isolated Preview',async()=>{
 for(const change of [{VERCEL_ENV:'production'},{TIME2PAY_SECURITY_NOTICES_ENABLED:'false'},{VERCEL_GIT_COMMIT_REF:'other'}]){
 const f=setup({uid:'owner'},{...configured,...change});assert.equal((await f.route.POST(new NextRequest('https://preview.example/api/auth/recovery/notice-check',{method:'POST'}))).status,404);assert.deepEqual(f.counts(),{created:0,dispatched:0});}
});
test('notice probe requires a genuine application session before creating or querying notices',async()=>{
 const f=setup(new Response('Unauthorized',{status:401}));
 assert.equal((await f.route.POST(new NextRequest('https://preview.example/api/auth/recovery/notice-check',{method:'POST'}))).status,401);
 assert.equal((await f.route.GET(new NextRequest('https://preview.example/api/auth/recovery/notice-check?id=other'))).status,401);
 assert.deepEqual(f.counts(),{created:0,dispatched:0});assert.equal(f.lookups.length,0);
});
test('notice probe fixes test recipient and kind; status lookup binds owner and exposes no raw provider data',async()=>{
 const f=setup({uid:'owner',email:'private@example.invalid'});
 assert.equal((await f.route.POST(new NextRequest('https://preview.example/api/auth/recovery/notice-check',{method:'POST'}))).status,200);
 assert.deepEqual(f.counts(),{created:1,dispatched:1});
 assert.equal((await f.route.GET(new NextRequest('https://preview.example/api/auth/recovery/notice-check?id=foreign'))).status,404);
 assert.deepEqual(JSON.parse(JSON.stringify(f.lookups[0].where)),{id:'foreign',userId:'owner',kind:'PREVIEW_RETRY_CHECK'});
 assert.ok(!Object.hasOwn(f.lookups[0].select,'email'));assert.ok(!Object.hasOwn(f.lookups[0].select,'providerId'));
});
