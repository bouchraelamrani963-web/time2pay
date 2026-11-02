"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { matchesUrl, matchesFirebase, enabledTotp, diagnose } = require("../scripts/diagnose-production-config.cjs");
const host = "ep-withered-flower-alwyxd3z.c-3.eu-central-1.aws.neon.tech";
const url = (h,db="neondb") => "postgresql://reader:password@" + h + "/" + db;
test("only exact production database endpoint and name are accepted", () => {
 assert.equal(matchesUrl(url(host)),true);
 assert.equal(matchesUrl(url(host,"test")),false);
 assert.equal(matchesUrl(url("wrong.example.com")),false);
 assert.equal(matchesUrl(""),false);
 assert.equal(matchesUrl("https://reader:password@" + host + "/neondb"),false);
});
test("only production Firebase IDs without test secrets are accepted", () => {
 const e = { FIREBASE_PROJECT_ID:"time2pay-c5c5c", NEXT_PUBLIC_FIREBASE_PROJECT_ID:"time2pay-c5c5c", FIREBASE_CLIENT_EMAIL:"admin@time2pay-c5c5c.iam.gserviceaccount.com" };
 assert.equal(matchesFirebase(e),true);
 assert.equal(matchesFirebase({...e,TIME2PAY_TOTP_TEST_PROJECT_ID:"test"}),false);
 assert.equal(matchesFirebase({...e,FIREBASE_PROJECT_ID:"test"}),false);
});
test("TOTP requires both MFA and provider enabled", () => {
 const c = { multiFactorConfig:{ state:"ENABLED",providerConfigs:[{ state:"ENABLED",totpProviderConfig:{adjacentIntervals:1} }] } };
 assert.equal(enabledTotp(c),true);
 assert.equal(enabledTotp({...c,multiFactorConfig:{...c.multiFactorConfig,state:"DISABLED"}}),false);
 assert.equal(enabledTotp(null),false);
});
test("unauthorized execution is blocked before remote SDK access", async () => {
 assert.deepEqual(await diagnose({}),{guard:"BLOCKED"});
 assert.deepEqual(await diagnose({VERCEL_ENV:"preview",TIME2PAY_DIAGNOSTIC_APPROVED:"true"}),{guard:"BLOCKED"});
 assert.deepEqual(await diagnose({VERCEL_ENV:"production"}),{guard:"BLOCKED"});
});
test("payments must stay disabled before remote access", async () => {
 const r=await diagnose({VERCEL_ENV:"production", TIME2PAY_DIAGNOSTIC_APPROVED:"true",TIME2PAY_LIVE_PAYMENTS_ENABLED:"true",DATABASE_URL:url(host),DIRECT_URL:url(host)});
 assert.equal(r.checks.PAYMENTS_DISABLED,"FAIL");
 assert.equal(r.checks.ACTIVE_DATABASE,"NOT_RUN");
 assert.equal(r.checks.FIREBASE_TOTP,"NOT_RUN");
});
