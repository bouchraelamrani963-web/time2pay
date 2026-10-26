import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

const requiredBaseAdminEnv = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL"] as const;

let adminApp: App | undefined;
let adminAuth: Auth | undefined;

export function getMissingFirebaseAdminEnv(): string[] {
  if (process.env.TIME2PAY_TOTP_TEST_PROJECT_ID) {
    return process.env.FIREBASE_TEST_SERVICE_ACCOUNT_JSON ? [] : ["FIREBASE_TEST_SERVICE_ACCOUNT_JSON"];
  }
  const missing: string[] = requiredBaseAdminEnv.filter((key) => !process.env[key]);

  if (!process.env.FIREBASE_PRIVATE_KEY_BASE64 && !process.env.FIREBASE_PRIVATE_KEY) {
    missing.push("FIREBASE_PRIVATE_KEY_BASE64 or FIREBASE_PRIVATE_KEY");
  }

  return missing;
}

function getFirebasePrivateKey(): string {
  const base64Key = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  if (base64Key) {
    return Buffer.from(base64Key, "base64").toString("utf8").trim();
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    return privateKey.replace(/\\n/g, "\n").trim();
  }

  const error = new Error("Firebase Admin-configuratie ontbreekt: FIREBASE_PRIVATE_KEY_BASE64 or FIREBASE_PRIVATE_KEY");
  Object.assign(error, { code: "time2pay/missing-firebase-admin-private-key" });
  throw error;
}

function getAdminApp(): App {
  // A Production build must never authenticate against copied Preview settings.
  if (process.env.VERCEL_ENV === "production" && (
      process.env.FIREBASE_PROJECT_ID !== "time2pay-c5c5c" ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "time2pay-c5c5c" ||
      !process.env.FIREBASE_CLIENT_EMAIL?.endsWith("@time2pay-c5c5c.iam.gserviceaccount.com") ||
      process.env.TIME2PAY_TOTP_TEST_PROJECT_ID || process.env.FIREBASE_TEST_SERVICE_ACCOUNT_JSON)) {
    throw new Error("De Firebase-productieconfiguratie is ongeldig.");
  }
  if (adminApp) return adminApp;

  const testProject = process.env.TIME2PAY_TOTP_TEST_PROJECT_ID;
  const appName = testProject ? "time2pay-isolated-test" : "[DEFAULT]";
  const existing = getApps().find(app => app.name === appName);
  if (existing) { adminApp = existing; return adminApp; }

  const missing = getMissingFirebaseAdminEnv();
  if (missing.length > 0) {
    const error = new Error(`Firebase Admin-configuratie ontbreekt: ${missing.join(", ")}`);
    Object.assign(error, { code: "time2pay/missing-firebase-admin-env" });
    throw error;
  }

  if (testProject) {
    try {
      const credentials = JSON.parse(process.env.FIREBASE_TEST_SERVICE_ACCOUNT_JSON as string);
      if (process.env.VERCEL_ENV === "production" || testProject === "time2pay-c5c5c" ||
          credentials.project_id !== testProject || process.env.FIREBASE_PROJECT_ID !== testProject ||
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== testProject ||
          typeof credentials.client_email !== "string" ||
          !credentials.client_email.endsWith(`@${testProject}.iam.gserviceaccount.com`) ||
          typeof credentials.private_key !== "string" || !credentials.private_key.startsWith("-----BEGIN PRIVATE KEY-----")) {
        throw new Error("invalid test credential");
      }
      adminApp = initializeApp({ credential: cert(credentials) }, appName);
      return adminApp;
    } catch {
      throw new Error("De geïsoleerde Firebase-testconfiguratie is ongeldig.");
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID as string;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL as string;
  const privateKey = getFirebasePrivateKey();

  adminApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  return adminApp;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}
