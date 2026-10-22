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
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[#33243b]">Klanten</h1>
          <p className="text-sm text-[#726671]">{clients.length} klant{clients.length !== 1 ? "en" : ""}</p>
        </div>
        <NewClientModal />
      </div>

      <div className="card overflow-x-auto">
        {clients.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#726671]">
            Nog geen klanten toegevoegd. Gebruik &ldquo;Klant toevoegen&rdquo; om je eerste klant vast te leggen.
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[#eee5e1] text-xs text-[#726671]">
                <th className="px-6 py-3 text-left font-medium">Naam</th>
                <th className="px-6 py-3 text-left font-medium">E-mail</th>
                <th className="px-6 py-3 text-left font-medium">Telefoon</th>
                <th className="px-6 py-3 text-center font-medium">Facturen</th>
                <th className="px-6 py-3 text-left font-medium">BTW-nummer</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-[#fbf8f5]">
                  <td className="px-6 py-3 font-semibold text-[#33243b]">
                    <Link href={`/clients/${c.id}`} className="text-[#543749] hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-[#675b66]">{c.email ?? "—"}</td>
                  <td className="px-6 py-3 text-[#675b66]">{c.phone ?? "—"}</td>
                  <td className="px-6 py-3 text-center">
                    <Link href={`/invoices?clientId=${c.id}`} className="text-[#543749] hover:underline font-semibold">
                      {c._count.invoices}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-[#726671] font-mono text-xs">{c.vatNumber ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
