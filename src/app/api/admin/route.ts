import { NextResponse } from "next/server";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { canUsePlatformAdmin } from "@/lib/admin/access";
import { parseAdminQuery, readAdminData } from "@/lib/admin/data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  } });
}

export async function GET(request: Request) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return json({ error: "Log opnieuw in." }, 401);
  if (!await canUsePlatformAdmin(user.uid)) return json({ error: "Geen toegang tot platformbeheer." }, 403);

  const query = parseAdminQuery(Object.fromEntries(new URL(request.url).searchParams));
  if (!query) return json({ error: "Ongeldige filters." }, 400);
  return json(await readAdminData(query));
}
