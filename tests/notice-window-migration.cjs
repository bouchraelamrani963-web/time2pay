// Only a disposable local CI database may run this synthetic migration fixture.
const assert=require('node:assert/strict'),fs=require('node:fs');
const url=new URL(process.env.DATABASE_URL);
assert.equal(process.env.TIME2PAY_RECOVERY_DB_TEST,'true');
assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
assert.equal(url.pathname,'/time2pay_recovery_ci');
const prisma=new(require('@prisma/client').PrismaClient)();
const ids=['ci-window-never-attempted','ci-window-ambiguous-attempt'];
const snapshot='/tmp/time2pay-notice-window-snapshot.json';
async function read(){return prisma.$queryRaw`SELECT to_jsonb(n)-'firstAttemptAt' AS original FROM security_notices n WHERE id IN (${ids[0]},${ids[1]}) ORDER BY id`;}
(async()=>{
 if(process.argv[2]==='seed'){
  for(let i=0;i<ids.length;i++)await prisma.$executeRaw`INSERT INTO security_notices (id,"userId",email,kind,attempts,"createdAt") VALUES (${ids[i]},'ci-window-owner','delivered@resend.dev','RECOVERY_STARTED',${i},TIMESTAMP '2026-01-01 00:00:00')`;
  fs.writeFileSync(snapshot,JSON.stringify(await read()));
 }else if(process.argv[2]==='assert'){
  assert.equal(JSON.stringify(await read()),fs.readFileSync(snapshot,'utf8'));
  const rows=await prisma.securityNotice.findMany({where:{id:{in:ids}}});
  assert.equal(rows.length,2);
  assert.equal(rows.find(r=>r.id===ids[0]).firstAttemptAt,null);
  const attempted=rows.find(r=>r.id===ids[1]);
  assert.equal(attempted.firstAttemptAt.toISOString(),attempted.createdAt.toISOString());
  console.log('Notice migration preserves original rows and conservative attempted-send deadlines');
 }else throw Error('Unknown migration phase');
})().finally(()=>prisma.$disconnect()).catch(error=>{console.error(error);process.exitCode=1;});
