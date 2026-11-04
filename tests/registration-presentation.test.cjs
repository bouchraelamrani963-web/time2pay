const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const modulePolicy = {exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/registration-trial-policy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:modulePolicy,exports:modulePolicy.exports,Date,Intl});
const {trialPresentation, freeTrial, launchTrialPeriod} = modulePolicy.exports;
const launched = '2026-11-02T10:47:06.983Z';
test('launch copy displays configured Dutch dates and matches entitlement end',()=>{
 const now=Date.parse('2026-11-04T12:00:00Z');
 const copy=trialPresentation(true,launched,now);
 assert.match(copy.headline,/Introductieactie: gratis tot 2 februari 2027/);
 assert.doesNotMatch(copy.headline,/3 maanden/);
 assert.match(copy.detail,/gegarandeerd minimaal 30 dagen/);
 assert.match(copy.detail,/niet bij iedere registratie drie volledige maanden/);
 assert.match(copy.detail,/2 november 2026/);assert.match(copy.detail,/2 februari 2027/);assert.match(copy.detail,/11:47:06/);
 assert.equal(freeTrial(new Date(now).toISOString(),launched,now).periodEnd,Math.floor(launchTrialPeriod(launched).periodEnd));
 assert.match(copy.after,/niet automatisch/);
});
test('unavailable, future, invalid and expired launch never advertise three months',()=>{
 for(const [enabled,date,now] of [[false,launched,Date.now()],[true,undefined,Date.now()],[true,'invalid',Date.now()],[true,launched,Date.parse('2026-11-01')],[true,launched,Date.parse('2027-02-02T10:47:06.983Z')]]){
  assert.doesNotMatch(trialPresentation(enabled,date,now).headline,/3 maanden/);
 }
});
test('late registration retains 30 days beyond campaign end',()=>{
 const now=Date.parse('2027-02-01T12:00:00Z');
 assert.equal(freeTrial(new Date(now).toISOString(),launched,now).periodEnd,now/1000+30*86400);
});
test('homepage primary and closing actions and navigation link directly to registration',()=>{
 const home=fs.readFileSync('src/components/LandingPage.tsx','utf8');
 assert.equal((home.match(/Gratis account aanmaken <ArrowRight/g)||[]).length,2);
 assert.equal((home.match(/href="\/register"/g)||[]).length,2);
 assert.match(fs.readFileSync('src/components/Navbar.tsx','utf8'),/href="\/register"/);
 assert.equal(JSON.parse(fs.readFileSync('vercel.json')).git.deploymentEnabled['improve/registration-trial-20261104'],false);
});
