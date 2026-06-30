import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";

const CreateClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  vatNumber: z.string().optional(),
});

type SafeErrorInfo = {
  name?: string;
  code?: string;
  message: string;
};

function getSafeErrorInfo(err: unknown): SafeErrorInfo {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return { name: err.name, code: err.code, message: err.message };
  }

  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }

  return { message: "Onbekende fout" };
}

function logSafeError(context: string, err: unknown) {
  console.error(context, getSafeErrorInfo(err));
}

function databaseErrorResponse(err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2022") {
    return NextResponse.json(
      {
        error: "Database schema is niet bijgewerkt",
        message: "Voer de user-scoping migratie uit voordat je klanten aanmaakt.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      error: "Klant aanmaken mislukt",
      message: "De klant kon niet worden opgeslagen.",
    },
    { status: 500 }
  );
}

export async function GET() {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;

  try {
    const clients = await prisma.client.findMany({
      where: { userId: user.uid },
      orderBy: { name: "asc" },
      include: { _count: { select: { invoices: true } } },
    });
    return NextResponse.json(clients);
  } catch (err) {
    logSafeError("Klanten ophalen mislukt", err);
    return NextResponse.json(
      { error: "Klanten ophalen mislukt", message: "De klanten konden niet worden geladen." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;

  try {
    const body = await req.json();
    const data = CreateClientSchema.parse(body);
    const client = await prisma.client.create({
      data: {
        userId: user.uid,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        vatNumber: data.vatNumber || null,
      },
    });
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Ongeldige klantgegevens",
          message: "Controleer de naam en het e-mailadres.",
          issues: err.errors,
        },
        { status: 422 }
      );
    }

    logSafeError("Klant aanmaken mislukt", err);
    return databaseErrorResponse(err);
  }
}
