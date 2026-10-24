// Destructive rehearsal is restricted to the disposable local CI database.
const assert=require('node:assert/strict'),fs=require('node:fs');
const url=new URL(process.env.DATABASE_URL);
assert.equal(process.env.TIME2PAY_RECOVERY_DB_TEST,'true');
assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.equal(url.pathname,'/time2pay_recovery_ci');
const prisma=new(require('@prisma/client').PrismaClient)();
const userId='migration-preservation-synthetic',snapshot='/tmp/time2pay-migration-snapshot.json';
async function read(){return {account:await prisma.billingAccount.findUnique({where:{userId}}),
 client:await prisma.client.findFirst({where:{userId},include:{invoices:{include:{items:true}}}})};}
(async()=>{
 const action=process.argv[2];
 if(action==='seed'){
  await prisma.billingAccount.create({data:{userId,customerId:'cus_disposable_fixture',subscriptionId:'sub_disposable_fixture',freeInvoiceUsed:true}});
  await prisma.client.create({data:{userId,name:'Synthetic preserved customer',shiftRates:{DAY:55.5,NIGHT:80},ortAgreed:true,
   invoices:{create:{userId,number:'CI-PRESERVE-001',dueDate:new Date('2026-11-01'),vatRate:21,subtotal:111,vatAmount:23.31,total:134.31,
    items:{create:{type:'HOURS',description:'Preserve test invoice',serviceType:'DAY',quantity:2,unitPrice:55.5,lineTotal:111}}}}}});
  fs.writeFileSync(snapshot,JSON.stringify(await read()));
 }else if(action==='assert'){assert.equal(JSON.stringify(await read()),fs.readFileSync(snapshot,'utf8'));console.log('Existing account, customer, invoice, items and rates preserved');}
 else if(action==='disturb')await prisma.client.updateMany({where:{userId},data:{name:'Synthetic restoration probe'}});
 else throw Error('Unknown rehearsal phase');
})().finally(()=>prisma.$disconnect()).catch(error=>{console.error(error);process.exitCode=1;});
