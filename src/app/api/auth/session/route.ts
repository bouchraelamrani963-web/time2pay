import { RecoveryError, exchangeRecoverySession, deliverSecurityNotices } from "@/lib/account-recovery";
import { RECOVERY_COOKIE, recoveryEnabled } from "@/lib/recovery-config";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth, getMissingFirebaseAdminEnv } from "@/lib/firebase-admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_DAYS } from "@/lib/auth";

import { getMfaConfiguration, isRecentSignIn, mfaAccessError } from "@/lib/auth-policy";

export const runtime = "nodejs";

function safeErrorInfo(error: unknown) {
  const record = typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
  return {
    name: typeof record.name === "string" ? record.name : error instanceof Error ? error.name : "UnknownError",
    code: typeof record.code === "string" ? record.code : undefined,
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

export async function GET() {
  return NextResponse.json({ ...getMfaConfiguration(), recoveryEnabled: recoveryEnabled() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "invalid_origin", message: "Ongeldig verzoek." }, { status: 403 });
  }
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

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    if (!isRecentSignIn(decoded.auth_time)) {
      return NextResponse.json({ error: "recent_login_required", message: "Log opnieuw in om verder te gaan." }, { status: 401 });
    }
    let account = await auth.getUser(decoded.uid);
    const recoveryResult = await exchangeRecoverySession(decoded, account, (await cookies()).get(RECOVERY_COOKIE)?.value);
    if (recoveryResult.recovered) account = await auth.getUser(decoded.uid);
    const accessError = mfaAccessError(decoded, account);
    if (accessError) {
      const messages = {
        account_disabled: "Dit account is uitgeschakeld.",
        recovery_required: "Voltooi eerst je beveiligde accountherstel.",
        email_verification_required: "Bevestig eerst je e-mailadres.",
        mfa_setup_required: "Stel eerst je authenticator-app in.",
        mfa_required: "Voer de code uit je authenticator-app in.",
      };
      return NextResponse.json({ error: accessError, message: messages[accessError] }, { status: 403 });
    }
    const expiresIn = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });

    (await cookies()).set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresIn / 1000,
      path: "/",
    });

    if (recoveryResult.recovered) (await cookies()).delete(RECOVERY_COOKIE);
    if (recoveryEnabled()) await deliverSecurityNotices(decoded.uid);
    return NextResponse.json({ ok: true, ...recoveryResult }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof RecoveryError) return NextResponse.json({ error: error.code,
      message: error.code === "mfa_setup_required" ? "Stel eerst je nieuwe authenticator in." : "Voltooi je beveiligde accountherstel of log opnieuw in." },
      { status: error.status, headers: { "Cache-Control": "no-store, private" } });
    const info = safeErrorInfo(error);
    console.error("[auth/session POST]", info);
    return NextResponse.json(
      { error: "session_cookie_failed", message: "Inloggen is niet gelukt. Probeer opnieuw." },
      { status: 401 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  try {
    const cookieStore = await cookies();
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
