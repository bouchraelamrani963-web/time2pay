import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "./firebase-admin";

export const SESSION_COOKIE = "__time2pay_session";
export const SESSION_MAX_AGE_DAYS = 5;

export interface SessionUser {
  uid: string;
  email: string | null;
  name: string | null;
}

/**
 * Read & verify the Firebase session cookie. Returns null if not signed in.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Same as getSession(), but redirects to /login if not authenticated.
 * Use this in server components and route handlers that require auth.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

/**
 * For API route handlers: returns the user or throws a 401 Response.
 */
export async function requireUserOrUnauthorized(): Promise<SessionUser | Response> {
  const user = await getSession();
  if (!user) {
    return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
