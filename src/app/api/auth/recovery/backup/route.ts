import { NextResponse } from "next/server";
// Retired endpoint: stale Preview clients must never start reserve enrollment.
export async function POST() {
  return NextResponse.json({ error: "unavailable", message: "Deze functie is niet beschikbaar. Gebruik je authenticator en herstelcodes." },
    { status: 410, headers: { "Cache-Control": "no-store, private" } });
}
