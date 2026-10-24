const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
const {NextResponse}=require('next/server');
function load(file,stubs={}) {
 const module={exports:{}};
 const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(output,{module,exports:module.exports,Response,Request,URL,Buffer,FormData,Date,console,require:n=>Object.hasOwn(stubs,n)?stubs[n]:n.startsWith('@/')?load('src/'+n.slice(2)+'.ts',stubs):n.startsWith('./')?load(path.join(path.dirname(file),n)+'.ts',stubs):require(n)});
 return module.exports;
}
const calc=load('src/lib/calculations.ts'),pricing=load('src/lib/shift-rates.ts');
const rates={DAY:45,EVENING:50,WEEKEND:60,NIGHT:65,HOLIDAY:80};
const line=(serviceType='DAY',unitPrice=rates[serviceType],ortPerc=0)=>({type:'HOURS',serviceType,description:'Synthetische testdienst',quantity:8,unitPrice,unit:'uur',ortPerc});
test('five customer-specific fixed rates, with no implied ORT',()=>{
 for(const type of pricing.SHIFT_TYPES){assert.equal(pricing.hourlyRate(rates,type),rates[type]);assert.equal(calc.calcInvoiceTotals([line(type)],21).total,Math.round(8*rates[type]*121)/100);}
 assert.equal(pricing.hourlyRate({DAY:0},'DAY'),0);assert.equal(pricing.hourlyRate({},'NIGHT'),null);
 assert.equal(pricing.hourlyRate(rates,'WEEKEND',true),45);
 assert.equal(pricing.hourlyRate({DAY:37,WEEKEND:52},'WEEKEND'),52);
});
test('ORT requires both saved customer agreement and per-invoice opt in',()=>{
 for(const pct of [25,50,100]) {
  assert.ok(pricing.ortPermissionError([line('NIGHT',45,pct)],false,true));
  assert.ok(pricing.ortPermissionError([line('NIGHT',45,pct)],true,false));
  assert.equal(pricing.ortPermissionError([line('NIGHT',45,pct)],true,true),null);
  const totals=calc.calcInvoiceTotals([line('NIGHT',45,pct)],21);
  assert.equal(totals.ortAmount,360*pct/100);assert.equal(totals.total,Math.round((360+360*pct/100)*121)/100);
 }
});
test('reject invalid rates, precision, non-hour ORT and non-hour services',()=>{
 for(const value of [-1,Infinity,NaN,1.001,100001])assert.equal(pricing.ShiftRatesSchema.safeParse({DAY:value}).success,false);
 for(const type of ['M2','MATERIAL','FIXED'])for(const field of [{ortPerc:25},{serviceType:'NIGHT'}])assert.equal(pricing.InvoiceItemSchema.safeParse({...line(),type,serviceType:null,...field}).success,false);
 assert.equal(pricing.InvoiceItemSchema.safeParse({...line(),ortPerc:30}).success,false);
});
test('fractional hours and half-cent rounding are exact, VAT includes ORT once',()=>{
 assert.equal(calc.calcLineTotal({...line(),unitPrice:2.01,quantity:0.5}),1.01);
 assert.equal(calc.calcLineTotal({...line(),unitPrice:10.07,quantity:1.5}),15.11);
 const totals=calc.calcInvoiceTotals([{...line(),quantity:1.5,ortPerc:25},{...line(),type:'MATERIAL',quantity:3,unitPrice:2.1,ortPerc:0}],21);
 assert.equal(totals.subtotal,90.68);assert.equal(totals.ortAmount,16.88);assert.equal(totals.vatAmount,19.04);assert.equal(totals.total,109.72);
 for(const vat of [0,9,21])assert.equal(calc.calcInvoiceTotals([line('WEEKEND')],vat).vatAmount,480*vat/100);
});
function postFixture(clientAgreed=true) {
 let written;
 const route=load('src/app/api/invoices/route.ts',{'@/lib/auth':{requireUserOrUnauthorized:async()=>({uid:'owner'})},'@/lib/billing':{hasPaidSubscription:async()=>true},'@/lib/prisma':{prisma:{client:{findFirst:async({where})=>where.id==='private'?null:{id:where.id,ortAgreed:clientAgreed}},$transaction:async fn=>fn({invoice:{create:async({data})=>{written=data;return{id:'invoice',...data};}}})}}});
 return {route,written:()=>written};
}
const request=data=>new Request('https://test.example/api/invoices',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:'client',dueDate:'2026-11-01',vatRate:21,items:[line()],...data})});
test('customer API stores rates and agreement under the authenticated owner',async()=>{
 let data;
 const route=load('src/app/api/clients/route.ts',{'@/lib/auth':{requireUserOrUnauthorized:async()=>({uid:'owner'})},'@/lib/prisma':{prisma:{client:{create:async args=>{data=args.data;return{id:'client',...data};}}}}});
 const make=pricing=>new Request('https://test.example/api/clients',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Synthetic customer',userId:'other-user',...pricing})});
 assert.equal((await route.POST(make({shiftRates:rates,ortAgreed:true}))).status,201);
 assert.equal(data.userId,'owner');assert.equal(data.shiftRates.WEEKEND,60);assert.equal(data.ortAgreed,true);
 data=null;assert.equal((await route.POST(make({shiftRates:{DAY:-5}}))).status,422);assert.equal(data,null);
});
test('POST independently calculates persisted totals and copies the chosen service/rate snapshot',async()=>{
 const f=postFixture();const response=await f.route.POST(request({items:[{...line('WEEKEND'),lineTotal:99999,ortBedrag:99999}]}));assert.equal(response.status,201);
 const w=f.written();assert.equal(w.ortAgreed,false);assert.equal(w.subtotal,480);assert.equal(w.total,580.8);assert.equal(w.items.create[0].serviceType,'WEEKEND');assert.equal(w.items.create[0].unitPrice,60);assert.equal(w.items.create[0].ortBedrag,0);
 rates.WEEKEND=75;assert.equal(w.items.create[0].unitPrice,60);rates.WEEKEND=60;
});
test('POST rejects unagreed ORT and another user\'s customer without writes',async()=>{
 for(const [clientAgreed,ortAgreed] of [[false,true],[true,false]]){const f=postFixture(clientAgreed);assert.equal((await f.route.POST(request({ortAgreed,items:[line('NIGHT',45,25)]}))).status,422);assert.equal(f.written(),undefined);}
 const f=postFixture();assert.equal((await f.route.POST(request({clientId:'private'}))).status,404);assert.equal(f.written(),undefined);
});
test('PATCH recalculates VAT-only changes, preserves existing VAT on item edits, locks issued pricing',async()=>{
 let current={id:'invoice',clientId:'client',status:'DRAFT',ortAgreed:false,vatRate:9,items:[line('WEEKEND')]},write;
 let issued=false;
 const tx={$executeRaw:async()=>{},invoiceIssue:{findUnique:async()=>issued?{invoiceId:"invoice"}:null},invoice:{findFirst:async()=>current,updateMany:async({data})=>{write=data;return{count:1};}},client:{findFirst:async()=>({id:'client',ortAgreed:true})},invoiceItem:{deleteMany:async()=>{},createMany:async()=>{}}};
 const route=load('src/app/api/invoices/[id]/route.ts',{'@/lib/auth':{requireUserOrUnauthorized:async()=>({uid:'owner'})},'@/lib/prisma':{prisma:{invoice:{findFirst:async()=>({id:'invoice'})},$transaction:fn=>fn(tx)}},'@/lib/billing':{hasPaidSubscription:async()=>true},'@/lib/invoice-issuance':{authorizeInvoiceIssue:async()=>null}});
 const patch=data=>route.PATCH(new Request('https://test.example/api/invoices/invoice',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(data)}),{params:{id:'invoice'}});
 assert.equal((await patch({vatRate:21})).status,200);assert.equal(write.total,580.8);
 assert.equal((await patch({items:[line('EVENING')]})).status,200);assert.equal(write.vatRate,9);assert.equal(write.total,436);
 issued=true;write=null;for(const edit of [{ortAgreed:true},{notes:'changed'},{status:'DRAFT'}])assert.equal((await patch(edit)).status,409);assert.equal(write,null);issued=false;
 current={...current,status:'SENT'};write=null;assert.equal((await patch({vatRate:0})).status,409);assert.equal(write,null);
});
test('invoice view, PDF and HTML/text email use matching services, item totals, ORT and VAT',()=>{
 const items=[line('WEEKEND',60),line('NIGHT',45,25)].map((item,index)=>({...item,id:'test-'+index,lineTotal:calc.calcLineTotal(item),ortBedrag:calc.calcOrtAmount(item)}));
 const totals=calc.calcInvoiceTotals(items,21);
 const invoice={number:'F-SYNTHETIC',issueDate:new Date('2026-10-24'),dueDate:new Date('2026-11-07'),notes:null,vatRate:21,...totals,items,client:{name:'Synthetic test',email:'delivered@resend.dev',address:null,vatNumber:null}};
 const pdf=load('src/lib/invoice-pdf.ts').buildInvoicePdf(invoice,'Test sender');
 assert.ok(pdf.toString('latin1').includes('Weekenddienst'));assert.ok(pdf.toString('latin1').includes('Nachtdienst'));assert.ok(pdf.toString('latin1').includes('ORT 25%'));assert.ok(pdf.toString('latin1').includes('450,00'));
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const view=load('src/components/InvoiceView.tsx',{'next/navigation':{useRouter:()=>({})}}).default;
 const html=renderToStaticMarkup(React.createElement(view,{canExport:false,invoice:{...invoice,id:'invoice',status:'DRAFT'}}));
 for(const text of ['Weekenddienst','Nachtdienst','ORT 25','450,00','930,00','195,30','1.125,30'])assert.ok(html.includes(text),text);
 const email=load('src/lib/invoice-email-content.ts');const params={...invoice,clientName:'<script>Test</script>',invoiceNumber:invoice.number,senderName:'Test sender'};
 for(const output of [email.buildInvoiceHtml(params),email.buildInvoiceText(params)])for(const text of ['Weekenddienst','Nachtdienst','ORT 25%','450,00','930,00','195,30','1.125,30'])assert.ok(output.includes(text),text);
 assert.ok(!email.buildInvoiceHtml(params).includes('<script>'));
 fs.mkdirSync('/tmp/time2pay-rates-qa',{recursive:true});fs.writeFileSync('/tmp/time2pay-rates-qa/invoice.pdf',pdf);fs.writeFileSync('/tmp/time2pay-rates-qa/invoice.html',email.buildInvoiceHtml(params));
});
