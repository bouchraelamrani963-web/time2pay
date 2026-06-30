import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

const requiredAdminEnv = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;

let adminApp: App | undefined;
let adminAuth: Auth | undefined;

export function getMissingFirebaseAdminEnv(): string[] {
  const values: Record<(typeof requiredAdminEnv)[number], string | undefined> = {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  };

  return requiredAdminEnv.filter((key) => !values[key]);
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
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY as string).replace(/\\n/g, "\n");

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
