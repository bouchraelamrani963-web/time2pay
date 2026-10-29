import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { RecoveryError, assertRecoveryEnabled, takeRecoveryRate } from "./account-recovery";

export function recoveryJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private", Pragma: "no-cache",
    "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}
export function recoveryFailure(error: unknown) {
  const rate = error instanceof RecoveryError && error.status === 429;
  const unavailable = error instanceof RecoveryError && error.status === 503;
  return recoveryJson({ error: rate ? "try_later" : unavailable ? "recovery_unavailable" : "invalid_recovery",
    message: rate ? "Te veel pogingen. Probeer het later opnieuw." : unavailable ? "Herstel is nog niet beschikbaar." :
      "Herstel is niet gelukt. Controleer je gegevens of neem contact op met support." }, rate ? 429 : unavailable ? 503 : 403);
}
export async function readRecoveryBody(req: NextRequest) {
  assertRecoveryEnabled();
  if (req.headers.get("origin") !== new URL(req.url).origin ||
      !req.headers.get("content-type")?.startsWith("application/json")) throw new RecoveryError("invalid_recovery");
  const ip = req.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() || "unknown";
  await takeRecoveryRate("ip", ip, 20, 900);
  const reader = req.body?.getReader();
  if (!reader) throw new RecoveryError("invalid_recovery");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 8192) { await reader.cancel(); throw new RecoveryError("invalid_recovery"); }
    chunks.push(part.value);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!body || Array.isArray(body) || typeof body !== "object") throw new RecoveryError("invalid_recovery");
  return body as Record<string, unknown>;
}
export function field(body: Record<string, unknown>, key: string, max: number) {
  const value = body[key];
  if (typeof value !== "string" || value.length === 0 || value.length > max) throw new RecoveryError("invalid_recovery");
  return value;
}
