const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
const {NextResponse} = require('next/server');
function load(file, stubs) {
 const module = {exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {module,exports:module.exports,Response,Request,URL,console,require:n=>Object.hasOwn(stubs,n)?stubs[n]:require(n)});
 return module.exports;
}
function fixture() {
 const ledger=[];
 let entitlement={subscriptionId:'sub-test',periodStart:100,periodEnd:200,starter:true};
 let tail=Promise.resolve();
 const tx={ $executeRaw:async()=>{},
  invoice:{findFirst:async({where})=>where.userId==='owner' && where.id!=='missing'?{id:where.id}:null},
  invoiceIssue:{
   findUnique:async({where:{userId_invoiceId:w}})=>ledger.find(x=>x.userId===w.userId&&x.invoiceId===w.invoiceId),
   count:async({where:w})=>ledger.filter(x=>x.userId===w.userId&&x.subscriptionId===w.subscriptionId&&x.periodStart===w.periodStart).length,
   create:async({data})=>{ledger.push(data);return data;},
  }
 };
 const prisma={$transaction:fn=>{const run=tail.then(()=>fn(tx));tail=run.catch(()=>{});return run;}};
 const route=load('src/lib/invoice-issuance.ts',{'server-only':{},'next/server':{NextResponse},'./prisma':{prisma},'./invoice-access':{getInvoiceEntitlement:async()=>entitlement},'./billing':{
 paymentRequired:()=>NextResponse.json({code:'SUBSCRIPTION_REQUIRED'},{status:402})}});
 return {issue:route.authorizeInvoiceIssue,ledger,set:v=>entitlement=v,period:()=>({...entitlement})};
}
test('simultaneous first issues: 30 pass and invoice 31 is denied',async()=>{
 const f=fixture();const results=await Promise.all(Array.from({length:31},(_,i)=>f.issue('owner','invoice-'+i)));
 assert.equal(results.filter(x=>x===null).length,30);assert.equal(results.filter(x=>x?.status===409).length,1);assert.equal(f.ledger.length,30);
});
test('repeat PDF/send/print/reminder of an already issued invoice does not consume quota',async()=>{
 const f=fixture();await Promise.all(Array.from({length:35},()=>f.issue('owner','same')));assert.equal(f.ledger.length,1);
});
test('renewed subscription period resets allowance and old issued invoices remain idempotent',async()=>{
 const f=fixture();await Promise.all(Array.from({length:30},(_,i)=>f.issue('owner','old'+i)));
 f.set({...f.period(),periodStart:200,periodEnd:300});assert.equal(await f.issue('owner','new'),null);assert.equal(await f.issue('owner','old0'),null);assert.equal(f.ledger.length,31);
});
test('non-Starter plans do not inherit Starter quota',async()=>{
 const f=fixture();f.set({...f.period(),starter:false});const r=await Promise.all(Array.from({length:31},(_,i)=>f.issue('owner','pro'+i)));assert.ok(r.every(x=>x===null));
});
test('ownership is checked and cancellation denies even previously issued invoices',async()=>{
 const f=fixture();assert.equal((await f.issue('other','private')).status,404);assert.equal((await f.issue('owner','missing')).status,404);assert.equal(f.ledger.length,0);
 await f.issue('owner','same');f.set(null);assert.equal((await f.issue('owner','same')).status,402);assert.equal(f.ledger.length,1);
});
test('free users can create multiple drafts without consulting Stripe or billing records',async()=>{
 let created=0;
 const pricing=load('src/lib/shift-rates.ts',{}),calc=load('src/lib/calculations.ts',{});
 const prisma={client:{findFirst:async()=>({id:'client'})},$transaction:async fn=>fn({invoice:{create:async()=>({id:'draft'+ ++created})}})};
 const r=load('src/app/api/invoices/route.ts',{'next/server':{NextResponse},'@/lib/prisma':{prisma},'@/lib/auth':{requireUserOrUnauthorized:async()=>({uid:'owner'})},
 '@/lib/shift-rates':pricing,'@/lib/calculations':calc,'@/lib/invoice-status':{}});
 for(let i=0;i<2;i++) assert.equal((await r.POST(new Request('https://test.example/api/invoices',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:'client',dueDate:'2026-11-01',items:[{type:'HOURS',description:'Test',quantity:1,unitPrice:10}]})}))).status,201);
 assert.equal(created,2);
});
test('trial finalizations are unlimited, owned, idempotent and do not consume the later Starter allowance',async()=>{
 const f=fixture();f.set({subscriptionId:'trial:owner',periodStart:1,periodEnd:100,starter:false});
 assert.equal((await f.issue('other','private')).status,404);
 const r=await Promise.all(Array.from({length:35},(_,i)=>f.issue('owner','trial'+i)));
 assert.ok(r.every(x=>x===null));assert.equal(f.ledger.length,35);
 await f.issue('owner','trial0');assert.equal(f.ledger.length,35);
 f.set(null);assert.equal((await f.issue('owner','trial0')).status,402);
 f.set({subscriptionId:'sub_paid',periodStart:100,periodEnd:200,starter:true});
 const paid=await Promise.all(Array.from({length:31},(_,i)=>f.issue('owner','paid'+i)));
 assert.equal(paid.filter(x=>x===null).length,30);assert.equal(paid.filter(x=>x?.status===409).length,1);
 assert.equal(await f.issue('owner','trial0'),null);assert.equal(f.ledger.length,65);
});
