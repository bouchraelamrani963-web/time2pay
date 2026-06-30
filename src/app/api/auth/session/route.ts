import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth, getMissingFirebaseAdminEnv } from "@/lib/firebase-admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_DAYS } from "@/lib/auth";

export const runtime = "nodejs";

function safeErrorInfo(error: unknown) {
  const record = typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
  return {
    name: typeof record.name === "string" ? record.name : error instanceof Error ? error.name : "UnknownError",
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : error instanceof Error ? error.message : "Onbekende fout",
  };
}

function firebaseAdminEnvError() {
  const missing = getMissingFirebaseAdminEnv();
  if (missing.length === 0) return null;

  return NextResponse.json(
    {
      error: "firebase_admin_env_missing",
      message: `Firebase Admin-configuratie ontbreekt: ${missing.join(", ")}. Gebruik bij voorkeur FIREBASE_PRIVATE_KEY_BASE64; FIREBASE_PRIVATE_KEY blijft als fallback ondersteund.`,
      missing,
    },
    { status: 500 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const envError = firebaseAdminEnvError();
    if (envError) return envError;

    const body = await req.json().catch(() => null);
    const idToken = body && typeof body === "object" && "idToken" in body ? body.idToken : null;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { error: "id_token_missing", message: "ID token ontbreekt." },
        { status: 400 }
      );
    }

    const expiresIn = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });

    cookies().set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresIn / 1000,
      path: "/",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const info = safeErrorInfo(error);
    console.error("[auth/session POST]", info);
    return NextResponse.json(
      { error: "session_cookie_failed", message: "Sessie aanmaken mislukt.", details: info },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = cookies();
    const session = cookieStore.get(SESSION_COOKIE)?.value;
    if (session) {
      const envError = firebaseAdminEnvError();
      if (!envError) {
        try {
          const decoded = await getAdminAuth().verifySessionCookie(session);
          await getAdminAuth().revokeRefreshTokens(decoded.sub);
        } catch (error) {
          console.error("[auth/session DELETE revoke]", safeErrorInfo(error));
        }
      }
    }
    cookieStore.delete(SESSION_COOKIE);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/session DELETE]", safeErrorInfo(error));
    return NextResponse.json({ error: "logout_failed", message: "Uitloggen mislukt." }, { status: 500 });
  }
}
