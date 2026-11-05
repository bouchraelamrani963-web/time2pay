const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(sessionFailure=false){
 const calls=[];let index=0;const state=['Fictieve Tester','tester@example.invalid','fictional-only-password',null,false];
 const module={exports:{}};
 class SessionError extends Error{constructor(code){super(code);this.code=code;}}
 const router={push:path=>calls.push(['navigate',path]),refresh:()=>calls.push(['refresh'])};
 const stubs={react:{useState:()=>{const i=index++;return[state[i],v=>{state[i]=v}]}},'next/link':{default:'a'},'@/components/BrandLogo':{default:()=>null},'next/navigation':{useRouter:()=>router},'lucide-react':new Proxy({},{get:()=>()=>null}),'react-hot-toast':{success:()=>{}},'firebase/auth':{createUserWithEmailAndPassword:async(auth,email)=>{assert.equal(email,'tester@example.invalid');calls.push(['create']);return{user:{getIdToken:async()=> 'synthetic-token'}}},updateProfile:async()=>calls.push(['profile'])},'@/lib/auth-client-session':{SessionError,startSession:async()=>{calls.push(['session']);if(sessionFailure)throw new SessionError('mfa_setup_required')}},'@/lib/firebase-client':{getFirebaseAuth:()=>({isolated:true})},'@/lib/registration-trial-policy':{trialPresentation:()=>({headline:'Test',detail:'Test',after:'Test'})}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/RegisterForm.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:n=>Object.hasOwn(stubs,n)?stubs[n]:require(n),Error});
 const tree=module.exports.default({trialEnabled:true});
 function find(node){if(!node||typeof node!=='object')return;if(node.type==='form')return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child);if(found)return found;}}
 return{calls,submit:()=>find(tree).props.onSubmit({preventDefault(){}})};
}
test('isolated registration creates fictitious account and continues to dashboard when session is authorized',async()=>{const f=fixture();await f.submit();assert.deepEqual(f.calls.map(c=>c[0]),['create','profile','session','navigate','refresh']);assert.equal(f.calls[3][1],'/dashboard')});
test('new account requiring TOTP goes to security setup instead of dashboard',async()=>{const f=fixture(true);await f.submit();assert.equal(f.calls.at(-1)[1],'/login?security=setup');assert.ok(!f.calls.some(c=>c[1]==='/dashboard'))});
