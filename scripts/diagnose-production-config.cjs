"use strict";
// Standalone, read-only. No public endpoint, cron, or build integration.
const PROJECT = "time2pay-c5c5c";
const DB = "neondb";
const HOSTS = new Set([
 "ep-withered-flower-alwyxd3z.c-3.eu-central-1.aws.neon.tech",
 "ep-withered-flower-alwyxd3z-pooler.c-3.eu-central-1.aws.neon.tech"
]);
function matchesUrl(value) {
 if (typeof value !== "string" || !value) return false;
 try {
  const u = new URL(value);
  return ["postgres:", "postgresql:"].includes(u.protocol)
   && HOSTS.has(u.hostname.toLowerCase()) && decodeURIComponent(u.pathname.slice(1)) === DB
   && Boolean(u.username && u.password);
 } catch { return false; }
}
function matchesFirebase(env) {
 return env.FIREBASE_PROJECT_ID === PROJECT
  && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === PROJECT
  && typeof env.FIREBASE_CLIENT_EMAIL === "string"
  && env.FIREBASE_CLIENT_EMAIL.endsWith("@" + PROJECT + ".iam.gserviceaccount.com")
  && !env.TIME2PAY_TOTP_TEST_PROJECT_ID && !env.FIREBASE_TEST_SERVICE_ACCOUNT_JSON;
}
function enabledTotp(config) {
 const m = config?.multiFactorConfig;
 return m?.state === "ENABLED" && Array.isArray(m.providerConfigs)
  && m.providerConfigs.some(p => p?.state === "ENABLED" && Boolean(p.totpProviderConfig));
}
async function diagnose(env = process.env) {
 // Remote access is forbidden unless separately approved and in production context.
 if (env.VERCEL_ENV !== "production" || env.TIME2PAY_DIAGNOSTIC_APPROVED !== "true")
  return { guard: "BLOCKED" };
 const result = {
  PAYMENTS_DISABLED: env.TIME2PAY_LIVE_PAYMENTS_ENABLED === "false" ? "PASS" : "FAIL",
  DATABASE_URL_TARGET: matchesUrl(env.DATABASE_URL) ? "PASS" : "FAIL",
  DIRECT_URL_TARGET: matchesUrl(env.DIRECT_URL) ? "PASS" : "FAIL",
  ACTIVE_DATABASE: "NOT_RUN",
  FIREBASE_PROJECT: matchesFirebase(env) ? "PASS" : "FAIL",
  FIREBASE_TOTP: "NOT_RUN"
 };
 if (result.PAYMENTS_DISABLED !== "PASS") return { checks: result };
 if (result.DATABASE_URL_TARGET === "PASS" && result.DIRECT_URL_TARGET === "PASS") {
  let prisma;
  try {
   const { PrismaClient } = require("@prisma/client");
   prisma = new PrismaClient({ log: [], datasources: { db: { url: env.DATABASE_URL } } });
   const rows = await prisma.$queryRaw`SELECT current_database() AS db_name`;
   result.ACTIVE_DATABASE = rows?.[0]?.db_name === DB ? "PASS" : "FAIL";
  } catch { result.ACTIVE_DATABASE = "UNKNOWN"; }
  finally { if (prisma) try { await prisma.$disconnect(); } catch {} }
 }
 if (result.FIREBASE_PROJECT === "PASS") {
  let app;
  try {
   const privateKey = env.FIREBASE_PRIVATE_KEY_BASE64
    ? Buffer.from(env.FIREBASE_PRIVATE_KEY_BASE64, "base64").toString("utf8").trim()
    : (env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
   if (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) {
    result.FIREBASE_TOTP = "UNKNOWN";
   } else {
    const { initializeApp, cert, deleteApp } = require("firebase-admin/app");
    const { getAuth } = require("firebase-admin/auth");
    app = initializeApp({ credential: cert({
     projectId: PROJECT, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey
    }) }, "time2pay-readonly-production-diagnose");
    const config = await getAuth(app).projectConfigManager().getProjectConfig();
    result.FIREBASE_TOTP = enabledTotp(config) ? "PASS" : "FAIL";
    await deleteApp(app); app = undefined;
   }
  } catch { result.FIREBASE_TOTP = "UNKNOWN"; }
  finally { if (app) try { await require("firebase-admin/app").deleteApp(app); } catch {} }
 }
 return { checks: result };
}
if (require.main === module) {
 diagnose().then(r => {
  if (r.guard) { console.log("DIAGNOSTIC_GUARD: BLOCKED"); process.exitCode = 2; return; }
  for (const [k,v] of Object.entries(r.checks)) console.log(k + ": " + v);
  if (Object.values(r.checks).some(v => v !== "PASS")) process.exitCode = 1;
 }).catch(() => { console.log("DIAGNOSTIC: UNKNOWN"); process.exitCode = 1; });
}
module.exports = { matchesUrl, matchesFirebase, enabledTotp, diagnose };
