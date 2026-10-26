import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { hasPaidSubscription } from "@/lib/billing";
import { getRegistrationTrial } from "@/lib/registration-trial";
import BillingPlans from "@/components/BillingPlans";

export default async function BillingPage({ searchParams: promisedSearchParams }: { searchParams: Promise<{ result?: string }> }) {
  const searchParams = await promisedSearchParams;
  const user = await requireUser();
  const [paid, account, trial] = await Promise.all([
    hasPaidSubscription(user.uid),
    prisma.billingAccount.findUnique({ where: { userId: user.uid }, select: { customerId: true } }),
    getRegistrationTrial(user.uid),
  ]);
  return <div className="space-y-6">
    <h1 className="text-3xl font-semibold">Je abonnement</h1>
    <p>Conceptfacturen blijven gratis. Na je eventuele gratis periode heb je voor verzenden, definitieve PDF en afdrukken een betaald abonnement nodig.</p>
    {searchParams.result === "success" && <p role="status" className="card p-4">
      {paid ? "Je betaling is bevestigd. Je kunt je factuur nu verzenden, downloaden of afdrukken." :
        "We wachten op de bevestiging van je betaling. Vernieuw deze pagina over enkele ogenblikken."}
    </p>}
    {searchParams.result === "cancelled" && <p role="status">Je bent teruggekeerd zonder het afrekenen af te ronden. Je conceptfactuur blijft bewaard.</p>}
    {!paid && trial && <p role="status" className="card p-4">Je gebruikt Time2Pay gratis tot {new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(trial.periodEnd * 1000)}. Verzenden, definitieve PDF en afdrukken zijn inbegrepen. Na afloop kies je zelf een abonnement. Er wordt niets automatisch afgeschreven.</p>}
    <BillingPlans trialActive={!paid && !!trial} paid={paid} hasCustomer={!!account?.customerId} />
  </div>;
}
