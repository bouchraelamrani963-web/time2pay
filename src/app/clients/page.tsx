import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import NewClientModal from "@/components/NewClientModal";

export default async function ClientsPage() {
  const user = await requireUser();
  const clients = await prisma.client.findMany({
    where: { userId: user.uid },
    orderBy: { name: "asc" },
    include: { _count: { select: { invoices: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Klanten</h1>
          <p className="text-sm text-gray-500">{clients.length} klant{clients.length !== 1 ? "en" : ""}</p>
        </div>
        <NewClientModal />
      </div>

      <div className="card overflow-hidden">
        {clients.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">
            Nog geen klanten. Klik op &ldquo;Klant toevoegen&rdquo; om te beginnen.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="px-6 py-3 text-left font-medium">Naam</th>
                <th className="px-6 py-3 text-left font-medium">E-mail</th>
                <th className="px-6 py-3 text-left font-medium">Telefoon</th>
                <th className="px-6 py-3 text-center font-medium">Facturen</th>
                <th className="px-6 py-3 text-left font-medium">BTW-nummer</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 font-semibold text-gray-900">{c.name}</td>
                  <td className="px-6 py-3 text-gray-600">{c.email ?? "—"}</td>
                  <td className="px-6 py-3 text-gray-600">{c.phone ?? "—"}</td>
                  <td className="px-6 py-3 text-center">
                    <Link href={`/invoices?clientId=${c.id}`} className="text-blue-600 hover:underline font-semibold">
                      {c._count.invoices}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-gray-500 font-mono text-xs">{c.vatNumber ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
