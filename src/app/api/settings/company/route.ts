import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const CompanySettingsSchema = z.object({
  companyName: z.string().trim().min(1, "Bedrijfsnaam is verplicht"),
  contactName: z.string().trim().min(1, "Contactpersoon is verplicht"),
  street: z.string().trim().min(1, "Straat + huisnummer is verplicht"),
  postalCode: z.string().trim().min(1, "Postcode is verplicht"),
  city: z.string().trim().min(1, "Plaats is verplicht"),
  kvkNumber: z.string().trim().min(1, "KvK-nummer is verplicht"),
  vatId: z.string().trim().min(1, "Btw-id is verplicht"),
  iban: z.string().trim().min(1, "IBAN is verplicht"),
  email: z.string().trim().email("Vul een geldig e-mailadres in"),
  phone: z.string().trim().optional(),
});

export async function GET() {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;

  try {
    const settings = await prisma.companySettings.findUnique({
      where: { userId: user.uid },
    });

    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "Bedrijfsgegevens ophalen mislukt" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;

  try {
    const body = await req.json();
    const data = CompanySettingsSchema.parse(body);
    const phone = data.phone?.trim() || null;

    const settings = await prisma.companySettings.upsert({
      where: { userId: user.uid },
      create: {
        userId: user.uid,
        ...data,
        phone,
      },
      update: {
        ...data,
        phone,
      },
    });

    return NextResponse.json(settings);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }

    return NextResponse.json({ error: "Bedrijfsgegevens opslaan mislukt" }, { status: 500 });
  }
}