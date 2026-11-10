import { NextResponse } from "next/server";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { mollieMode, mollieRedirectUri, newOAuthNonce, signOAuthState } from "@/lib/mollie-connect";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;
  if (!mollieMode() || !process.env.MOLLIE_CLIENT_ID) {
    return NextResponse.json({ error: "Mollie is nog niet beschikbaar." }, { status: 503 });
  }
  try {
    const nonce = newOAuthNonce();
    const params = new URLSearchParams({
      client_id: process.env.MOLLIE_CLIENT_ID, redirect_uri: mollieRedirectUri(),
      state: nonce, response_type: "code",
      scope: "payment-links.read payment-links.write payments.read profiles.read",
      locale: "nl_NL",
    });
    const response = NextResponse.redirect("https://my.mollie.com/oauth2/authorize?" + params.toString());
    response.cookies.set("time2pay_mollie_state", signOAuthState(user.uid, nonce), {
      httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/mollie",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Mollie is nog niet geconfigureerd." }, { status: 503 });
  }
}
