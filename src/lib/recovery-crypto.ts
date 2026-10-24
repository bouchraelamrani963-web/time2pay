import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function recoveryDigest(pepper: string, purpose: string, value: string) {
  if (Buffer.byteLength(pepper) < 32) throw new Error("Recovery secret missing");
  return createHmac("sha256", pepper).update(purpose).update("\0").update(value).digest("hex");
}
export function normalizeRecoveryCode(code: string) {
  const normalized = code.replace(/-/g, "").trim().toUpperCase();
  return /^[A-F0-9]{32}$/.test(normalized) ? normalized : null;
}
export function createRecoveryCodes() {
  const codes = new Set<string>();
  while (codes.size < 10) codes.add(randomBytes(16).toString("hex").toUpperCase().match(/.{4}/g)!.join("-"));
  return Array.from(codes);
}
export function equalDigest(a: string | null | undefined, b: string) {
  if (!a || !/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
