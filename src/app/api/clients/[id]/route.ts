import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

const CLIENT_HAS_INVOICES_MESSAGE =
  "Deze klant kan niet worden verwijderd omdat er facturen aan deze klant gekoppeld zijn.";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({
        where: { id: params.id, userId: user.uid },
        select: { id: true },
      });

      if (!client) return "not_found" as const;

      const invoiceCount = await tx.invoice.count({
        where: { clientId: params.id, userId: user.uid },
      });

      if (invoiceCount > 0) return "has_invoices" as const;

      const deleteResult = await tx.client.deleteMany({
        where: { id: params.id, userId: user.uid },
      });

      return deleteResult.count === 1 ? "deleted" : "not_found";
    });

    if (result === "not_found") {
      return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
    }

    if (result === "has_invoices") {
      return NextResponse.json(
        {
          error: "Klant verwijderen geblokkeerd",
          message: CLIENT_HAS_INVOICES_MESSAGE,
        },
        { status: 409 }
      );
    }

    revalidatePath("/clients");
    revalidatePath(`/clients/${params.id}`);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        {
          error: "Klant verwijderen geblokkeerd",
          message: CLIENT_HAS_INVOICES_MESSAGE,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "Klant verwijderen mislukt",
        message: "De klant kon niet worden verwijderd.",
      },
      { status: 500 }
    );
  }
}
