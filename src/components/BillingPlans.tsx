"use client";
import { useState } from "react";
import { BILLING_PLANS, type BillingPlan } from "@/lib/billing-plans";

export default function BillingPlans({ paid, hasCustomer }: { paid: boolean; hasCustomer: boolean }) {
  const [busy, setBusy] = useState<BillingPlan | "portal" | null>(null);
  const [error, setError] = useState("");
  async function checkout(plan: BillingPlan) {
    setBusy(plan); setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }),
      });
      const body = await response.json();
      if (!response.ok || !body.url) throw new Error(body.error || "Afrekenen openen mislukt");
      const url = new URL(body.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("Ongeldige betaallink");
      window.location.assign(url.href);
    } catch (err) { setError(err instanceof Error ? err.message : "Probeer het later opnieuw"); }
    finally { setBusy(null); }
  }
  async function manage() {
    setBusy("portal"); setError("");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.url) throw new Error(body.error || "Portaal openen mislukt");
      const url = new URL(body.url);
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com") throw new Error("Ongeldige portaallink");
      window.location.assign(url.href);
    } catch (err) { setError(err instanceof Error ? err.message : "Probeer het later opnieuw"); }
    finally { setBusy(null); }
  }
  return <div className="space-y-5">
    {hasCustomer && <button className="btn-secondary" disabled={busy !== null} onClick={manage}>
      {busy === "portal" ? "Openen…" : "Abonnement en betaalgegevens beheren"}
    </button>}
    {error && <p role="alert" className="rounded-md bg-red-50 p-4 text-red-800">{error}</p>}
    <div className="grid gap-5 md:grid-cols-3">
      {(Object.entries(BILLING_PLANS) as [BillingPlan, typeof BILLING_PLANS[BillingPlan]][]).map(([key, plan]) =>
        <div className="card p-6 space-y-5" key={key}>
          <h2 className="text-xl font-semibold">{plan.name}</h2>
          <p className="text-3xl font-semibold">€{plan.cents / 100}<span className="text-sm font-normal"> / maand</span></p>
          <p className="text-sm">Inclusief btw. Maandelijks automatisch verlengd.</p>
          <button className="btn-primary" disabled={paid || busy !== null} onClick={() => checkout(key)}>
            {paid ? "Je hebt al een abonnement" : busy === key ? "Openen…" : `Kies ${plan.name}`}
          </button>
        </div>)}
    </div>
  </div>;
}
