import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Routing rules:
 *   "/"           -> public (marketing landing page, no auth)
 *   "/uren-factureren-zzp" -> public marketing guide
 *   "/login"      -> public
 *   "/register"   -> public
 *   "/robots.txt", "/sitemap.xml" -> public SEO files
 *   "/time2pay-originele-schermdemo.mp4" -> public homepage demo
 *   "/forgot-password" -> public, environment-gated by the page
 *   "/api/auth/*" -> public (Firebase session exchange endpoints)
 *   "/api/*"      -> handled by route-level auth and returns JSON 401
 *
 *   "/dashboard"  -> protected (requires session cookie)
 *   app pages      -> protected
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/uren-factureren-zzp" ||
    pathname === "/register" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/time2pay-originele-schermdemo.mp4" ||
    pathname === "/forgot-password" ||
    pathname === "/recover" ||
    pathname.startsWith("/.well-known/workflow/") ||
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
    "/((?!_next/static|_next/image|favicon.ico|.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
