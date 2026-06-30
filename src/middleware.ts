import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Routing rules:
 *   "/"           -> public (marketing landing page, no auth)
 *   "/login"      -> public
 *   "/register"   -> public
 *   "/api/auth/*" -> public (Firebase session exchange endpoints)
 *   "/api/*"      -> handled by route-level auth and returns JSON 401
 *
 *   "/dashboard"  -> protected (requires session cookie)
 *   app pages      -> protected
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

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
