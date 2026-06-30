import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

const requiredBaseAdminEnv = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL"] as const;

let adminApp: App | undefined;
let adminAuth: Auth | undefined;

export function getMissingFirebaseAdminEnv(): string[] {
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
  if (adminApp) return adminApp;

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const missing = getMissingFirebaseAdminEnv();
  if (missing.length > 0) {
    const error = new Error(`Firebase Admin-configuratie ontbreekt: ${missing.join(", ")}`);
    Object.assign(error, { code: "time2pay/missing-firebase-admin-env" });
    throw error;
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
