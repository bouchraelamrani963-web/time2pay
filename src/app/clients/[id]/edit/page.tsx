import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ChevronLeft, Save } from "lucide-react";

function getText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, field: string) {
  const value = getText(formData, field);
  return value.length > 0 ? value : null;
}

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { error?: string };
}) {
  const user = await requireUser();
  const client = await prisma.client.findFirst({
    where: { id: params.id, userId: user.uid },
  });

  if (!client) notFound();

  async function updateClient(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    const name = getText(formData, "name");

    if (!name) {
      redirect(`/clients/${params.id}/edit?error=name`);
    }

    const result = await prisma.client.updateMany({
      where: { id: params.id, userId: currentUser.uid },
      data: {
        name,
        email: nullableText(formData, "email"),
        phone: nullableText(formData, "phone"),
        address: nullableText(formData, "address"),
        vatNumber: nullableText(formData, "vatNumber"),
      },
    });

    if (result.count === 0) notFound();

    revalidatePath("/clients");
    revalidatePath(`/clients/${params.id}`);
    redirect(`/clients/${params.id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/clients/${client.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ChevronLeft size={16} /> Terug naar klant
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Klant bewerken</h1>
        <p className="text-sm text-gray-500">Werk de gegevens van {client.name} bij.</p>
      </div>

      <form action={updateClient} className="card max-w-xl space-y-5 p-6">
        <div>
          <label className="label" htmlFor="name">
            Naam <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            className="input"
            defaultValue={client.name}
            required
          />
          {searchParams?.error === "name" && (
            <p className="mt-1 text-xs font-medium text-red-600">Naam is verplicht.</p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            defaultValue={client.email ?? ""}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="phone">Telefoon</label>
            <input
              id="phone"
              name="phone"
              className="input"
              defaultValue={client.phone ?? ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="vatNumber">BTW-nummer</label>
            <input
              id="vatNumber"
              name="vatNumber"
              className="input font-mono"
              defaultValue={client.vatNumber ?? ""}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="address">Adres</label>
          <textarea
            id="address"
            name="address"
            className="input h-24 resize-none"
            defaultValue={client.address ?? ""}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-5">
          <Link href={`/clients/${client.id}`} className="btn-secondary">
            Annuleren
          </Link>
          <button type="submit" className="btn-primary">
            <Save size={15} /> Wijzigingen opslaan
          </button>
        </div>
      </form>
    </div>
  );
}