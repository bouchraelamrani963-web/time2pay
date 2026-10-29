const test=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./recovery-fixture.cjs');
test('authentication diagnostics expose only public Firebase error identifiers, never provider messages or secrets',()=>{
 const {publicAuthErrorCode}=load('src/lib/auth-error-code.ts');
 assert.equal(publicAuthErrorCode({code:'auth/invalid-argument',message:'private password or grant'}),'auth/invalid-argument');
 for(const e of [null,{},new Error('private'),{code:'auth/private?token=secret'},{code:'auth/private key'},{code:'token-secret'}, {code:{toString:()=> 'secret'}}])assert.equal(publicAuthErrorCode(e),null);
});
