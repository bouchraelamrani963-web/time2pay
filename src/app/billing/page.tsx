import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { hasPaidSubscription } from "@/lib/billing";
import BillingPlans from "@/components/BillingPlans";

export default async function BillingPage({ searchParams: promisedSearchParams }: { searchParams: Promise<{ result?: string }> }) {
  const searchParams = await promisedSearchParams;
  const user = await requireUser();
  const [paid, account] = await Promise.all([
    hasPaidSubscription(user.uid),
    prisma.billingAccount.findUnique({ where: { userId: user.uid }, select: { customerId: true } }),
  ]);
  return <div className="space-y-6">
    <h1 className="text-3xl font-semibold">Je abonnement</h1>
    <p>Registreer gratis en stel conceptfacturen op. Voor verzenden, PDF downloaden en afdrukken kies je een betaald abonnement.</p>
    {searchParams.result === "success" && <p role="status" className="card p-4">
      {paid ? "Je betaling is bevestigd. Je kunt je factuur nu verzenden, downloaden of afdrukken." :
        "We wachten op de bevestiging van je betaling. Vernieuw deze pagina over enkele ogenblikken."}
    </p>}
    {searchParams.result === "cancelled" && <p role="status">Je bent teruggekeerd zonder het afrekenen af te ronden. Je conceptfactuur blijft bewaard.</p>}
    <BillingPlans paid={paid} hasCustomer={!!account?.customerId} />
  </div>;
}
