const test=require('node:test'),assert=require('node:assert/strict');
const {env,load,identity,token}=require('./recovery-fixture.cjs');
const crypto=load('src/lib/recovery-crypto.ts');
test('ten unique 128-bit recovery codes; normalization and hashes are purpose/user scoped',()=>{
 const codes=crypto.createRecoveryCodes();assert.equal(codes.length,10);assert.equal(new Set(codes).size,10);
 for(const c of codes){assert.match(c,/^[A-F0-9]{4}(?:-[A-F0-9]{4}){7}$/);assert.equal(crypto.normalizeRecoveryCode(c.toLowerCase()).length,32);}
 assert.equal(crypto.normalizeRecoveryCode('123456'),null);
 const a=crypto.recoveryDigest(env.TIME2PAY_RECOVERY_HASH_SECRET,'code:user-a',crypto.normalizeRecoveryCode(codes[0]));
 assert.equal(a.length,64);assert.ok(!a.includes(codes[0]));
 assert.notEqual(a,crypto.recoveryDigest(env.TIME2PAY_RECOVERY_HASH_SECRET,'code:user-b',crypto.normalizeRecoveryCode(codes[0])));
 assert.equal(crypto.equalDigest(a,a),true);assert.equal(crypto.equalDigest(null,a),false);
 assert.throws(()=>crypto.recoveryDigest('short','code','test'));
});
test('recovery refuses Production, shared auth, missing secrets and missing explicit test database marker',()=>{
 const file='src/lib/recovery-config.ts';assert.equal(load(file,{},env).recoveryEnabled(),true);
 for(const change of [{VERCEL_ENV:'production'},{TIME2PAY_RECOVERY_ENABLED:'false'},{FIREBASE_PROJECT_ID:'time2pay-c5c5c'},
  {NEXT_PUBLIC_FIREBASE_PROJECT_ID:'other'},{TIME2PAY_REQUIRE_TOTP:'false'},{TIME2PAY_RECOVERY_HASH_SECRET:''},{TIME2PAY_RECOVERY_DATABASE_ID:''}])
 assert.equal(load(file,{},{...env,...change}).recoveryEnabled(),false);
});
test('recovery completion requires a new signed TOTP factor, fresh password login, active grant and verified owner',()=>{
 const policy=load('src/lib/recovery-policy.ts'),user=identity('u','new'),t=token('u','new');
 const state={status:'ENROLLMENT_REQUIRED',startedAt:new Date(Date.now()-10000),expiresAt:new Date(Date.now()+60000),oldFactors:['old']};
 assert.equal(policy.mayCompleteRecovery(t,user,state),true);
 for(const bad of [{...t,firebase:{...t.firebase,sign_in_second_factor:'phone'}},{...t,auth_time:0},
  {...t,firebase:{...t.firebase,sign_in_provider:'custom'}},{...t,firebase:{...t.firebase,second_factor_identifier:'old'}}])
 assert.equal(policy.mayCompleteRecovery(bad,user,state),false);
 assert.equal(policy.mayCompleteRecovery(t,{...user,disabled:true},state),false);
 assert.equal(policy.mayCompleteRecovery(t,user,{...state,expiresAt:new Date(0)}),false);
 assert.equal(policy.mayCompleteRecovery(t,user,{...state,oldFactors:['new']}),false);
});
test('Firebase recovery lock denies normal sessions even when feature switches are disabled',()=>{
 const policy=load('src/lib/auth-policy.ts',{},{}),user=identity();
 assert.equal(policy.mfaAccessError(token(),{...user,customClaims:{time2payRecoveryLocked:true}},false),'recovery_required');
 assert.equal(policy.mfaAccessError({...token(),firebase:{...token().firebase,second_factor_identifier:'removed'}},user,true),'mfa_required');
});
test('password proof is obtained server-side from Firebase and binds the returned UID/email/factor',async()=>{
 let called=0;
 const user=identity();
 const stubs={'./prisma':{prisma:{accountRecovery:{findUnique:async()=>null}}},'./firebase-admin':{getAdminAuth:()=>({getUser:async uid=>{assert.equal(uid,user.uid);return user;}})},
  './email':{},fetch:async(url,request)=>{called++;assert.ok(url.startsWith('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='));
   assert.equal(JSON.parse(request.body).password,'test-password');
   return {ok:true,json:async()=>({localId:user.uid,email:user.email,mfaPendingCredential:'provider-only-proof',mfaInfo:[{mfaEnrollmentId:'old-factor'}]})};}};
 const core=load('src/lib/account-recovery.ts',stubs);
 assert.equal((await core.verifyRecoveryPassword(user.email,'test-password')).uid,user.uid);assert.equal(called,1);
 for(const response of [{localId:user.uid,email:'other@example.com',mfaPendingCredential:'x',mfaInfo:[]},{localId:user.uid,email:user.email,idToken:'password-only'}]){
  const r=load('src/lib/account-recovery.ts',{...stubs,fetch:async()=>({ok:true,json:async()=>response})});
  await assert.rejects(()=>r.verifyRecoveryPassword(user.email,'test-password'));
 }
});
test('disabled recovery endpoints fail before password checks or data writes',async()=>{
 for(const endpoint of ['start','support','codes','backup']){
  const core={assertRecoveryEnabled:()=>{throw Object.assign(Error('disabled'),{status:503});},takeRecoveryRate:()=>{throw Error('rate should not run');}};
  class RecoveryError extends Error {constructor(code,status=403){super(code);this.code=code;this.status=status;}}
  core.RecoveryError=RecoveryError;
  core.assertRecoveryEnabled=()=>{throw new RecoveryError('recovery_unavailable',503);};
  const route=load('src/app/api/auth/recovery/'+endpoint+'/route.ts',{'@/lib/account-recovery':core,'./account-recovery':core,
   '@/lib/auth':{SESSION_COOKIE:'test'},'@/lib/firebase-admin':{},'@/lib/prisma':{}},{...env,TIME2PAY_RECOVERY_ENABLED:'false'});
  const response=await route.POST(new Request('https://test.example/api/auth/recovery/'+endpoint,{method:'POST',headers:{origin:'https://test.example','content-type':'application/json'},body:'{}'}));
  assert.equal(response.status,503);assert.match(response.headers.get('cache-control'),/no-store/);
 }
});
test('recovery HTTP rejects cross-origin requests and oversized bodies without accepting secrets',async()=>{
 const http=load('src/lib/recovery-http.ts',{'./account-recovery':{assertRecoveryEnabled:()=>{},takeRecoveryRate:async()=>{},RecoveryError:class extends Error{}}});
 await assert.rejects(()=>http.readRecoveryBody(new Request('https://test.example',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'})));
 await assert.rejects(()=>http.readRecoveryBody(new Request('https://test.example',{method:'POST',headers:{origin:'https://test.example','content-type':'application/json'},body:JSON.stringify({value:'x'.repeat(9000)})})));
});
