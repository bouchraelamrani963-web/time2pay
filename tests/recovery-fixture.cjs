const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const env={VERCEL_ENV:'preview',TIME2PAY_RECOVERY_ENABLED:'true',TIME2PAY_RECOVERY_DATABASE_ID:'time2pay-stripe-test',
 TIME2PAY_REQUIRE_TOTP:'true',TIME2PAY_TOTP_SETUP_ENABLED:'true',TIME2PAY_TOTP_TEST_PROJECT_ID:'time2pay-preview',
 FIREBASE_PROJECT_ID:'time2pay-preview',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'time2pay-preview',
 NEXT_PUBLIC_FIREBASE_API_KEY:'public-test-key',TIME2PAY_RECOVERY_HASH_SECRET:'ci-test-only-public-value-not-for-real-users-123456789'};
function load(file,stubs={},configuration=env) {
 const module={exports:{}};
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(js,{module,exports:module.exports,Buffer,Date,Map,Set,Response,Request,URL,AbortSignal,Uint8Array,
  process:{env:configuration},console,
  fetch:stubs.fetch || (()=>{throw Error('Unexpected network request');}),
  require:n=>Object.hasOwn(stubs,n)?stubs[n]:n==='server-only'?{}:n.startsWith('@/')?load('src/'+n.slice(2)+'.ts',stubs,configuration):
    n.startsWith('./')?load(path.join(path.dirname(file),n)+'.ts',stubs,configuration):require(n)});
 return module.exports;
}
function identity(uid='synthetic-user',factor='old-factor') {
 return {uid,email:'delivered@resend.dev',emailVerified:true,disabled:false,customClaims:{unrelated:'preserved'},
  providerData:[{providerId:'password'}],multiFactor:{enrolledFactors:[{factorId:'totp',uid:factor}]}};
}
function token(uid='synthetic-user',factor='old-factor') {
 return {uid,auth_time:Date.now()/1000,email_verified:true,firebase:{sign_in_provider:'password',sign_in_second_factor:'totp',second_factor_identifier:factor}};
}
module.exports={env,load,identity,token};
