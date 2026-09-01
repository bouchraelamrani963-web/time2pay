import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrUnauthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;

  const owned = await prisma.invoice.findFirst({
    where: { id: params.id, userId: user.uid },
    select: { id: true, status: true },
  });

  if (!owned) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  return NextResponse.json(
    { error: "Betalingsherinneringen zijn nog niet geactiveerd." },
    { status: 501 }
  );
}