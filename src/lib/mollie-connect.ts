import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";

export type MollieMode = "test" | "live";
export class MolliePaymentError extends Error {
  constructor(message: string) { super(message); this.name = "MolliePaymentError"; }
}

export function mollieMode(): MollieMode | null {
  if (process.env.VERCEL_ENV === "production") {
    return process.env.MOLLIE_ENABLE_LIVE_PAYMENTS === "true" ? "live" : null;
  }
  return process.env.MOLLIE_PAYMENT_LINKS_ENABLED === "true" ? "test" : null;
}

export function mollieRedirectUri() {
  const uri = process.env.MOLLIE_REDIRECT_URI;
  if (!uri || !uri.startsWith("https://") || new URL(uri).pathname !== "/api/mollie/callback") {
    throw new MolliePaymentError("De Mollie-koppeling is nog niet ingericht.");
  }
  return uri;
}

function encryptionKey(): Buffer {
  const value = process.env.MOLLIE_TOKEN_ENCRYPTION_KEY;
  const bytes = value ? Buffer.from(value, "base64") : Buffer.alloc(0);
  if (bytes.length !== 32) throw new MolliePaymentError("De Mollie-koppeling is nog niet ingericht.");
  return bytes;
}
export function encryptToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function decryptToken(value: string): string {
  const bytes = Buffer.from(value, "base64");
  if (bytes.length < 29) throw new MolliePaymentError("Ongeldige Mollie-koppeling.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}

export function signOAuthState(uid: string, nonce: string): string {
  const signature = createHmac("sha256", encryptionKey()).update(uid + ":" + nonce).digest("hex");
  return nonce + "." + signature;
}
export function verifyOAuthState(uid: string, nonce: string, cookieValue: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(nonce)) return false;
  const expected = Buffer.from(signOAuthState(uid, nonce));
  const actual = Buffer.from(cookieValue);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function newOAuthNonce(): string { return randomBytes(32).toString("hex"); }

type TokenResponse = {
  access_token: string; refresh_token: string; expires_in: number; token_type: string; scope: string;
};
export async function exchangeMollieToken(fields: Record<string, string>): Promise<TokenResponse> {
  const id = process.env.MOLLIE_CLIENT_ID;
  const secret = process.env.MOLLIE_CLIENT_SECRET;
  if (!id || !secret) throw new MolliePaymentError("De Mollie-koppeling is nog niet ingericht.");
  const result = await fetch("https://api.mollie.com/oauth2/tokens", {
    method: "POST", cache: "no-store",
    headers: {
      Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json",
    },
    body: new URLSearchParams(fields),
  });
  if (!result.ok) throw new MolliePaymentError("Mollie kon de accountkoppeling niet voltooien.");
  const response = await result.json() as TokenResponse;
  if (!response.access_token || !response.refresh_token || !(response.expires_in > 0)) {
    throw new MolliePaymentError("Ongeldig antwoord van Mollie.");
  }
  return response;
}
export async function storeMollieConnection(uid: string, credentials: TokenResponse) {
  const token = encryptToken(credentials.access_token);
  const refresh = encryptToken(credentials.refresh_token);
  const expiresAt = new Date(Date.now() + (credentials.expires_in - 60) * 1000);
  return prisma.mollieConnection.upsert({
    where: { userId: uid },
    create: { userId: uid, accessTokenEnc: token, refreshTokenEnc: refresh, expiresAt, profileId: null },
    update: { accessTokenEnc: token, refreshTokenEnc: refresh, expiresAt, profileId: null },
  });
}
export async function getMollieAccessToken(uid: string): Promise<string> {
  const connection = await prisma.mollieConnection.findUnique({ where: { userId: uid } });
  if (!connection) throw new MolliePaymentError("Koppel eerst je eigen Mollie-account via Instellingen.");
  if (connection.expiresAt.getTime() > Date.now()) return decryptToken(connection.accessTokenEnc);
  const latest = await prisma.mollieConnection.findUnique({ where: { userId: uid } });
  if (latest && latest.expiresAt.getTime() > Date.now()) return decryptToken(latest.accessTokenEnc);
  const token = await exchangeMollieToken({ grant_type: "refresh_token", refresh_token: decryptToken(connection.refreshTokenEnc) });
  await prisma.mollieConnection.updateMany({
    where: { userId: uid, refreshTokenEnc: connection.refreshTokenEnc },
    data: {
      accessTokenEnc: encryptToken(token.access_token), refreshTokenEnc: encryptToken(token.refresh_token),
      expiresAt: new Date(Date.now() + Math.max(60, token.expires_in - 60) * 1000),
    },
  });
  const refreshed = await prisma.mollieConnection.findUnique({ where: { userId: uid } });
  if (!refreshed) throw new MolliePaymentError("Mollie-account is niet meer gekoppeld.");
  return decryptToken(refreshed.accessTokenEnc);
}
export async function mollieApi<T>(uid: string, path: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<T> {
  if (!path.startsWith("/v2/") || path.includes("://")) throw new MolliePaymentError("Ongeldig Mollie-verzoek.");
  const accessToken = await getMollieAccessToken(uid);
  const result = await fetch("https://api.mollie.com" + path, {
    method, cache: "no-store",
    headers: { Authorization: "Bearer " + accessToken, Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!result.ok) {
    // Do not log access tokens, customer data or the provider response.
    throw new MolliePaymentError("Mollie kon het betaalverzoek niet verwerken. Controleer je gekoppelde account.");
  }
  return result.json() as Promise<T>;
}
export type MollieProfile = { id: string; name: string; status: string };
export async function getMollieProfiles(uid: string): Promise<MollieProfile[]> {
  const result = await mollieApi<{ _embedded?: { profiles?: MollieProfile[] } }>(uid, "/v2/profiles?limit=250");
  return (result._embedded?.profiles || []).filter(profile => profile.id.startsWith("pfl_"));
}
