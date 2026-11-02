"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { matchesUrl, matchesFirebase, enabledTotp, diagnose } = require("../scripts/diagnose-production-config.cjs");
const host = "ep-withered-flower-alwyxd3z.c-3.eu-central-1.aws.neon.tech";
const url = (h,db="neondb") => "postgresql://reader:password@" + h + "/" + db + "?sslmode=require&sslaccept=strict";
test("only exact production database endpoint and name are accepted", () => {
 assert.equal(matchesUrl(url(host)),true);
 assert.equal(matchesUrl(url(host,"test")),false);
 assert.equal(matchesUrl(url("wrong.example.com")),false);
 assert.equal(matchesUrl(""),false);
 assert.equal(matchesUrl("https://reader:password@" + host + "/neondb"),false);
});
test("only production Firebase IDs without test secrets are accepted", () => {
 const e = { FIREBASE_PROJECT_ID:"time2pay-c5c5c", NEXT_PUBLIC_FIREBASE_PROJECT_ID:"time2pay-c5c5c", FIREBASE_CLIENT_EMAIL:"admin@time2pay-c5c5c.iam.gserviceaccount.com" };
 assert.equal(matchesFirebase(e),true);
 assert.equal(matchesFirebase({...e,TIME2PAY_TOTP_TEST_PROJECT_ID:"test"}),false);
 assert.equal(matchesFirebase({...e,FIREBASE_PROJECT_ID:"test"}),false);
});
test("TOTP requires both MFA and provider enabled", () => {
 const c = { multiFactorConfig:{ state:"ENABLED",providerConfigs:[{ state:"ENABLED",totpProviderConfig:{adjacentIntervals:1} }] } };
 assert.equal(enabledTotp(c),true);
 assert.equal(enabledTotp({...c,multiFactorConfig:{...c.multiFactorConfig,state:"DISABLED"}}),false);
 assert.equal(enabledTotp(null),false);
});
test("unauthorized execution is blocked before remote SDK access", async () => {
 assert.deepEqual(await diagnose({}),{guard:"BLOCKED"});
 assert.deepEqual(await diagnose({VERCEL_ENV:"preview",TIME2PAY_DIAGNOSTIC_APPROVED:"true"}),{guard:"BLOCKED"});
 assert.deepEqual(await diagnose({VERCEL_ENV:"production"}),{guard:"BLOCKED"});
});
test("payments must stay disabled before remote access", async () => {
 const r=await diagnose({VERCEL_ENV:"production", TIME2PAY_DIAGNOSTIC_APPROVED:"true",TIME2PAY_LIVE_PAYMENTS_ENABLED:"true",DATABASE_URL:url(host),DIRECT_URL:url(host)});
 assert.equal(r.checks.PAYMENTS_DISABLED,"FAIL");
 assert.equal(r.checks.ACTIVE_DATABASE,"NOT_RUN");
 assert.equal(r.checks.FIREBASE_TOTP,"NOT_RUN");
});


const fs=require('node:fs'),vm=require('node:vm');
const {format}=require('../scripts/diagnose-production-config.cjs');
const secret='SENTINEL_DO_NOT_PRINT';
const good={VERCEL_ENV:'production',TIME2PAY_DIAGNOSTIC_APPROVED:'true',TIME2PAY_LIVE_PAYMENTS_ENABLED:'false',
 DATABASE_URL:url(host),DIRECT_URL:url(host),FIREBASE_PROJECT_ID:'time2pay-c5c5c',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'time2pay-c5c5c',
 FIREBASE_CLIENT_EMAIL:'admin@time2pay-c5c5c.iam.gserviceaccount.com',FIREBASE_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\n'+secret};
function fixture({db='neondb',totp=true,error,hang,cleanupHang=false}={}) {
 const calls=[];
 class PrismaClient {
  constructor(options){calls.push(['prisma',options]);}
  $queryRaw(parts,...values){calls.push(['sql',parts.join(''),values]);if(error==='db')throw Error(secret);return hang==='db'?new Promise(()=>{}):Promise.resolve([{db_name:db}]);}
  $disconnect(){calls.push(['disconnect']);return cleanupHang?new Promise(()=>{}):Promise.resolve();}
 }
 const sdk={cert:c=>{calls.push(['cert']);return c;},initializeApp:o=>{calls.push(['init',o]);return {};},deleteApp:()=>{calls.push(['deleteApp']);return cleanupHang?new Promise(()=>{}):Promise.resolve();}};
 return {calls,load:n=>{
  calls.push(['load',n]);if(n==='@prisma/client')return {PrismaClient};if(n==='firebase-admin/app')return sdk;
  if(n==='firebase-admin/auth')return {getAuth:()=>({projectConfigManager:()=>({getProjectConfig:()=>{
   calls.push(['getProjectConfig']);if(error==='firebase')throw Error(secret);
   return hang==='firebase'?new Promise(()=>{}):Promise.resolve({multiFactorConfig:{state:'ENABLED',providerConfigs:[{state:totp?'ENABLED':'DISABLED',totpProviderConfig:{adjacentIntervals:1}}]}});
  }})})};throw Error('Unexpected module');
 }};
}
test('TLS is required with strict certificate verification and ambiguous/redirecting options are rejected',()=>{
 for(const query of ['', '?sslmode=disable','?sslmode=require','?sslmode=require&sslaccept=accept_invalid_certs',
 '?sslmode=require&sslaccept=strict&sslmode=disable','?sslmode=require&sslaccept=strict&host=attacker.invalid',
 '?sslmode=require&sslaccept=strict&sslcert=local-file'])assert.equal(matchesUrl('postgresql://u:p@'+host+'/neondb'+query),false);
 assert.equal(matchesUrl(url(host.replace('.c-3','-pooler.c-3'))),true);
 assert.equal(matchesUrl(url(host).replace('/neondb',':444/neondb')),false);
});
test('mock clients prove exact SELECT, bounded connection settings, config read and cleanup only',async()=>{
 const f=fixture(),r=await diagnose(good,f);
 assert.ok(Object.values(r.checks).every(v=>v==='PASS'));
 const query=f.calls.find(c=>c[0]==='sql');assert.equal(query[1],'SELECT current_database() AS db_name');assert.deepEqual(query[2],[]);
 const opts=f.calls.find(c=>c[0]==='prisma')[1],u=new URL(opts.datasources.db.url);
 assert.deepEqual(opts.log,[]);assert.equal(u.searchParams.get('sslaccept'),'strict');
 for(const k of ['connect_timeout','pool_timeout','socket_timeout'])assert.equal(u.searchParams.get(k),'5');
 assert.equal(f.calls.filter(c=>c[0]==='getProjectConfig').length,1);
 assert.ok(f.calls.some(c=>c[0]==='disconnect'));assert.ok(f.calls.some(c=>c[0]==='deleteApp'));
 assert.equal(f.calls.find(c=>c[0]==='init')[1].httpTimeout,5000);
 assert.doesNotMatch(format(r),/SENTINEL|postgresql|PRIVATE KEY|admin@/);
});
test('invalid TLS prevents loading Prisma and invalid Firebase project prevents loading Admin SDK',async()=>{
 const f=fixture();await diagnose({...good,DATABASE_URL:good.DATABASE_URL.replace('require','disable'),FIREBASE_PROJECT_ID:'wrong'},f);
 assert.equal(f.calls.length,0);
});
test('disabled payment gate and unsafe ambient overrides load no SDK',async()=>{
 for(const overrides of [{TIME2PAY_LIVE_PAYMENTS_ENABLED:'true'},{NODE_TLS_REJECT_UNAUTHORIZED:'0'},{FIREBASE_AUTH_EMULATOR_HOST:'localhost:9099'},
 {GOOGLE_APPLICATION_CREDENTIALS:'file'},{HTTPS_PROXY:'proxy'},{HTTP_PROXY:'proxy'},{ALL_PROXY:'proxy'}]){
  const f=fixture();await diagnose({...good,...overrides},f);assert.equal(f.calls.length,0);
 }
});
test('remote errors become UNKNOWN and always clean up without raw error output',async()=>{
 for(const error of ['db','firebase']){const f=fixture({error}),r=await diagnose(good,f);
 assert.equal(r.checks[error==='db'?'ACTIVE_DATABASE':'FIREBASE_TOTP'],'UNKNOWN');
 assert.doesNotMatch(format(r),/SENTINEL/);assert.ok(f.calls.some(c=>c[0]==='disconnect'));assert.ok(f.calls.some(c=>c[0]==='deleteApp'));}
});
test('database mismatch and disabled TOTP are FAIL rather than PASS',async()=>{
 const f=fixture({db:'other',totp:false}),r=await diagnose(good,f);
 assert.equal(r.checks.ACTIVE_DATABASE,'FAIL');assert.equal(r.checks.FIREBASE_TOTP,'FAIL');
});
test('hung Prisma/Firebase calls and cleanup return within explicit test deadlines',async()=>{
 for(const hang of ['db','firebase']){const f=fixture({hang,cleanupHang:true});const started=Date.now();
 const r=await diagnose(good,{...f,timeoutMs:10});assert.equal(r.checks[hang==='db'?'ACTIVE_DATABASE':'FIREBASE_TOTP'],'UNKNOWN');
 assert.ok(Date.now()-started<1000);}
});
test('CLI suppresses noisy SDK output and emits only allowlisted statuses',async()=>{
 const source=fs.readFileSync('scripts/diagnose-production-config.cjs','utf8'),out=[],exits=[],f=fixture();
 const module={exports:{}};const p={env:good,stdout:{write:s=>out.push(s)},stderr:{write:s=>out.push(s)},exit:c=>exits.push(c)};
 const load=n=>{p.stdout.write(secret);p.stderr.write(secret);return f.load(n);};load.main=module;
 vm.runInNewContext(source,{require:load,module,process:p,URL,Buffer,setTimeout,clearTimeout,console});
 for(let i=0;i<20&&!exits.length;i++)await new Promise(r=>setImmediate(r));
 assert.deepEqual(exits,[0]);assert.doesNotMatch(out.join(''),/SENTINEL/);
 assert.equal(out.join('').trim().split('\n').length,6);
 assert.match(out.join(''),/^PAYMENTS_DISABLED: PASS\n/);
});
test('CLI total watchdog exits without leaking SDK output even when operations never settle',async()=>{
 const source=fs.readFileSync('scripts/diagnose-production-config.cjs','utf8'),out=[],exits=[];let watchdog;
 const module={exports:{}},load=()=>({PrismaClient:class{$queryRaw(){return new Promise(()=>{});}}});load.main=module;
 const p={env:good,stdout:{write:s=>out.push(s)},stderr:{write:s=>out.push(s)},exit:c=>exits.push(c)};
 vm.runInNewContext(source,{require:load,module,process:p,URL,Buffer,console,
 setTimeout:(fn,ms)=>{if(ms===20000)watchdog=fn;return 1;},clearTimeout:()=>{}});
 assert.equal(typeof watchdog,'function');watchdog();assert.deepEqual(exits,[1]);assert.deepEqual(out,['DIAGNOSTIC: UNKNOWN\n']);
});
