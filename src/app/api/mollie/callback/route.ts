import { NextRequest, NextResponse } from "next/server";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { exchangeMollieToken, getMollieProfiles, mollieMode, mollieRedirectUri,
  storeMollieConnection, verifyOAuthState } from "@/lib/mollie-connect";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;
  const destination = new URL("/settings", request.url);
  if (!mollieMode()) return NextResponse.redirect(destination);
  const nonce = request.nextUrl.searchParams.get("state") || "";
  const cookie = request.cookies.get("time2pay_mollie_state")?.value || "";
  const code = request.nextUrl.searchParams.get("code");
  const response = NextResponse.redirect(destination);
  response.cookies.set("time2pay_mollie_state", "", { maxAge: 0, path: "/api/mollie" });
  if (!code || !verifyOAuthState(user.uid, nonce, cookie)) {
    destination.searchParams.set("mollie", "invalid");
    return NextResponse.redirect(destination, { headers: { "Set-Cookie": response.headers.get("Set-Cookie") || "" } });
  }
  try {
    const credentials = await exchangeMollieToken({
      grant_type: "authorization_code", code, redirect_uri: mollieRedirectUri(),
    });
    const scopes = new Set(credentials.scope.split(" "));
    if (!["payment-links.read", "payment-links.write", "payments.read", "profiles.read"].every(scope => scopes.has(scope))) {
      destination.searchParams.set("mollie", "scope");
      return NextResponse.redirect(destination);
    }
    await storeMollieConnection(user.uid, credentials);
    const profiles = await getMollieProfiles(user.uid);
    if (profiles.length === 1 && (mollieMode() === "test" || profiles[0].status === "verified")) {
      await prisma.mollieConnection.update({ where: { userId: user.uid }, data: { profileId: profiles[0].id } });
    }
    destination.searchParams.set("mollie", "connected");
  } catch {
    destination.searchParams.set("mollie", "failed");
  }
  const done = NextResponse.redirect(destination);
  done.cookies.set("time2pay_mollie_state", "", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 0, path: "/api/mollie" });
  return done;
}
