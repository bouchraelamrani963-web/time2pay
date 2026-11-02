"use strict";
// Standalone diagnostic; never imported by routes, cron or build scripts.
const PROJECT = "time2pay-c5c5c", DB = "neondb";
const HOSTS = new Set([
 "ep-withered-flower-alwyxd3z.c-3.eu-central-1.aws.neon.tech",
 "ep-withered-flower-alwyxd3z-pooler.c-3.eu-central-1.aws.neon.tech"
]);
const LIMITS = Object.freeze({ operation: 5000, cleanup: 1000, total: 20000 });
function matchesUrl(value) {
 try {
  if (typeof value !== 'string' || !value) return false;
  const u = new URL(value), q = u.searchParams;
  const allowed = new Set(['sslmode','sslaccept','connect_timeout','pool_timeout','socket_timeout','connection_limit','pgbouncer','schema']);
  return ['postgres:','postgresql:'].includes(u.protocol) && HOSTS.has(u.hostname.toLowerCase())
   && (!u.port || u.port === '5432') && !u.hash && decodeURIComponent(u.pathname.slice(1)) === DB
   && Boolean(u.username && u.password) && [...q.keys()].every(k => allowed.has(k) && q.getAll(k).length === 1)
   && q.get('sslmode') === 'require' && q.get('sslaccept') === 'strict'
   && (!q.has('schema') || q.get('schema') === 'public');
 } catch { return false; }
}
function boundedUrl(value) {
 const u = new URL(value);
 for (const [k,v] of Object.entries({connect_timeout:'5',pool_timeout:'5',socket_timeout:'5',connection_limit:'1'})) u.searchParams.set(k,v);
 return u.toString();
}
function matchesFirebase(e) {
 return e.FIREBASE_PROJECT_ID === PROJECT && e.NEXT_PUBLIC_FIREBASE_PROJECT_ID === PROJECT
  && typeof e.FIREBASE_CLIENT_EMAIL === 'string' && e.FIREBASE_CLIENT_EMAIL.endsWith('@'+PROJECT+'.iam.gserviceaccount.com')
  && !e.TIME2PAY_TOTP_TEST_PROJECT_ID && !e.FIREBASE_TEST_SERVICE_ACCOUNT_JSON;
}
function enabledTotp(c) {
 const m=c?.multiFactorConfig;
 return m?.state === 'ENABLED' && Array.isArray(m.providerConfigs)
  && m.providerConfigs.some(p=>p?.state === 'ENABLED' && Boolean(p.totpProviderConfig));
}
async function bounded(fn, ms) {
 let timer;
 try { return await Promise.race([Promise.resolve().then(fn), new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('TIMEOUT')),ms);})]); }
 finally { clearTimeout(timer); }
}
async function diagnose(env=process.env, deps={}) {
 if(env.VERCEL_ENV !== 'production' || env.TIME2PAY_DIAGNOSTIC_APPROVED !== 'true') return {guard:'BLOCKED'};
 const r={PAYMENTS_DISABLED:env.TIME2PAY_LIVE_PAYMENTS_ENABLED === 'false'?'PASS':'FAIL',
  DATABASE_URL_TARGET:matchesUrl(env.DATABASE_URL)?'PASS':'FAIL', DIRECT_URL_TARGET:matchesUrl(env.DIRECT_URL)?'PASS':'FAIL',
  ACTIVE_DATABASE:'NOT_RUN', FIREBASE_PROJECT:matchesFirebase(env)?'PASS':'FAIL', FIREBASE_TOTP:'NOT_RUN'};
 // Fail closed before loading any SDK, including ambient emulator/TLS overrides.
 if(r.PAYMENTS_DISABLED !== 'PASS' || env.NODE_TLS_REJECT_UNAUTHORIZED === '0' || env.FIREBASE_AUTH_EMULATOR_HOST || env.GOOGLE_APPLICATION_CREDENTIALS || env.HTTPS_PROXY || env.HTTP_PROXY || env.ALL_PROXY) return {checks:r};
 const load=deps.load || require, ms=deps.timeoutMs || LIMITS.operation;
 if(r.DATABASE_URL_TARGET === 'PASS' && r.DIRECT_URL_TARGET === 'PASS') {
  let client;
  try {
   const {PrismaClient}=load('@prisma/client');
   client=new PrismaClient({log:[],datasources:{db:{url:boundedUrl(env.DATABASE_URL)}}});
   const rows=await bounded(()=>client.$queryRaw`SELECT current_database() AS db_name`,ms);
   r.ACTIVE_DATABASE=rows?.[0]?.db_name === DB?'PASS':'FAIL';
  } catch {r.ACTIVE_DATABASE='UNKNOWN';}
  finally {if(client)try{await bounded(()=>client.$disconnect(),Math.min(ms,LIMITS.cleanup));}catch{}}
 }
 if(r.FIREBASE_PROJECT === 'PASS') {
  let app, deleteApp;
  try {
   const key=env.FIREBASE_PRIVATE_KEY_BASE64?Buffer.from(env.FIREBASE_PRIVATE_KEY_BASE64,'base64').toString('utf8').trim():(env.FIREBASE_PRIVATE_KEY||'').replace(/\\n/g,'\n').trim();
   if(!key.startsWith('-----BEGIN PRIVATE KEY-----')) throw Error('KEY');
   const sdk=load('firebase-admin/app'); deleteApp=sdk.deleteApp;
   app=sdk.initializeApp({credential:sdk.cert({projectId:PROJECT,clientEmail:env.FIREBASE_CLIENT_EMAIL,privateKey:key}),httpTimeout:LIMITS.operation},'time2pay-readonly-production-diagnose');
   const config=await bounded(()=>load('firebase-admin/auth').getAuth(app).projectConfigManager().getProjectConfig(),ms);
   r.FIREBASE_TOTP=enabledTotp(config)?'PASS':'FAIL';
  }catch{r.FIREBASE_TOTP='UNKNOWN';}
  finally {if(app)try{await bounded(()=>deleteApp(app),Math.min(ms,LIMITS.cleanup));}catch{}}
 }
 return {checks:r};
}
function format(r) {
 if(r.guard)return 'DIAGNOSTIC_GUARD: BLOCKED\n';
 const names=['PAYMENTS_DISABLED','DATABASE_URL_TARGET','DIRECT_URL_TARGET','ACTIVE_DATABASE','FIREBASE_PROJECT','FIREBASE_TOTP'];
 return names.map(k=>k+': '+(['PASS','FAIL','UNKNOWN','NOT_RUN'].includes(r.checks?.[k])?r.checks[k]:'UNKNOWN')).join('\n')+'\n';
}
if(require.main === module) {
 // Suppress SDK stdout/stderr at the process boundary; emit only the fixed allowlist.
 const emit=process.stdout.write.bind(process.stdout);
 process.stdout.write=process.stderr.write=()=>true;
 const timer=setTimeout(()=>{emit('DIAGNOSTIC: UNKNOWN\n');process.exit(1);},LIMITS.total);
 diagnose().then(r=>{clearTimeout(timer);emit(format(r));process.exit(r.guard?2:Object.values(r.checks).every(v=>v==='PASS')?0:1);})
 .catch(()=>{clearTimeout(timer);emit('DIAGNOSTIC: UNKNOWN\n');process.exit(1);});
}
module.exports={matchesUrl,matchesFirebase,enabledTotp,diagnose,format,LIMITS};
