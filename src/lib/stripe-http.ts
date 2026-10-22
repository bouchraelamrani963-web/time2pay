import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export function stripeIsConfigured() {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_PRICE_STARTER && process.env.STRIPE_PRICE_PRO && process.env.STRIPE_PRICE_BUSINESS);
}

export async function stripeRequest<T = Record<string, unknown>>(method: "GET" | "POST", path: string, params?: URLSearchParams): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe testomgeving niet geconfigureerd");
  const response = await fetch("https://api.stripe.com/v1" + path, {
    method,
    headers: {
      Authorization: "Bearer " + key,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params?.toString(),
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) {
    console.error("[Stripe] request failed", response.status, payload?.error?.type);
    throw new Error("Stripe kon de aanvraag niet verwerken.");
  }
  return payload as T;
}

export function verifyStripeSignature(payload: string, header: string | null, secret: string | undefined): boolean {
  if (!header || !secret) return false;
  const parts = new Map(header.split(",").map(piece => {
    const index = piece.indexOf("=");
    return [piece.slice(0, index), piece.slice(index + 1)] as [string, string];
  }));
  const timestamp = parts.get("t");
  const signatures = header.split(",").filter(s => s.startsWith("v1=")).map(s => s.slice(3));
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(timestamp + "." + payload).digest("hex");
  return signatures.some(sig => {
    if (!/^[0-9a-f]{64}$/i.test(sig)) return false;
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  });
}
