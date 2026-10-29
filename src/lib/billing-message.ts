export function billingMessage(status: string | null, trialActive: boolean) {
  if (status === "past_due" || status === "unpaid") return trialActive
    ? "Je abonnementsbetaling is mislukt. Je geldige gratis toegang blijft behouden. Werk je betaalgegevens bij via Abonnement en betaalgegevens beheren."
    : "Je abonnementsbetaling is mislukt. Verzenden, definitieve PDF en afdrukken zijn geblokkeerd totdat de betaling is bevestigd. Je conceptfacturen en klantgegevens blijven bewaard. Werk je betaalgegevens bij via Abonnement en betaalgegevens beheren.";
  if (status === "canceled") return trialActive
    ? "Je abonnement is beëindigd. Je geldige gratis toegang blijft behouden."
    : "Je abonnement is beëindigd. Je conceptfacturen en klantgegevens blijven bewaard. Kies een abonnement om weer te verzenden, downloaden of afdrukken.";
  return null;
}
