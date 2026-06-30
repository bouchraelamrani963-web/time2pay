import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase-admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_DAYS } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST  Exchange a Firebase ID token for an HttpOnly session cookie.
 * Body: { idToken: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "ID token ontbreekt" }, { status: 400 });
    }

    const expiresIn = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000; // ms
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });

    cookies().set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresIn / 1000,
      path: "/",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/session POST]", err);
    return NextResponse.json({ error: "Sessie aanmaken mislukt" }, { status: 401 });
  }
}

/**
 * DELETE  Log out – clear the cookie and revoke refresh tokens.
 */
export async function DELETE() {
  try {
    const cookieStore = cookies();
    const session = cookieStore.get(SESSION_COOKIE)?.value;
    if (session) {
      try {
        const decoded = await getAdminAuth().verifySessionCookie(session);
        await getAdminAuth().revokeRefreshTokens(decoded.sub);
      } catch {
        // cookie already invalid – fine, just clear it
      }
    }
    cookieStore.delete(SESSION_COOKIE);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Uitloggen mislukt" }, { status: 500 });
  }
}
