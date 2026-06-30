import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Routing rules:
 *   "/"           → public (marketing landing page, no auth)
 *   "/login"      → public
 *   "/register"   → public
 *   "/api/auth/*" → public (Firebase session exchange endpoints)
 *
 *   "/dashboard"  → protected (requires session cookie)
 *   everything else → protected
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Explicit public allowlist
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  // All other routes (incl. /dashboard, /invoices, /clients) require auth
  const session = request.cookies.get("__time2pay_session");
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
