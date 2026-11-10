import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { getMollieProfiles, mollieMode } from "@/lib/mollie-connect";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const Schema = z.object({ profileId: z.string().regex(/^pfl_[A-Za-z0-9]+$/) });
export async function GET() {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;
  if (!mollieMode()) return NextResponse.json({ error: "Niet beschikbaar" }, { status: 503 });
  const connection = await prisma.mollieConnection.findUnique({ where: { userId: user.uid } });
  if (!connection) return NextResponse.json({ connected: false, profiles: [] });
  try {
    return NextResponse.json({ connected: true, profileId: connection.profileId,
      profiles: await getMollieProfiles(user.uid) });
  } catch {
    return NextResponse.json({ error: "Mollie-profielen ophalen mislukt" }, { status: 502 });
  }
}
export async function POST(request: Request) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;
  if (!mollieMode()) return NextResponse.json({ error: "Niet beschikbaar" }, { status: 503 });
  const validation = Schema.safeParse(await request.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: "Ongeldig profiel" }, { status: 422 });
  try {
    const profiles = await getMollieProfiles(user.uid);
    const profile = profiles.find(p => p.id === validation.data.profileId);
    if (!profile || (mollieMode() === "live" && profile.status !== "verified")) {
      return NextResponse.json({ error: "Dit profiel is niet beschikbaar voor betalingen." }, { status: 422 });
    }
    await prisma.mollieConnection.update({ where: { userId: user.uid },
      data: { profileId: validation.data.profileId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Mollie-profiel opslaan mislukt." }, { status: 502 });
  }
}
