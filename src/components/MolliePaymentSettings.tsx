"use client";
import { useEffect, useState } from "react";
type Profile = { id: string; name: string; status: string };
type Result = { connected?: boolean; profileId?: string | null; profiles?: Profile[]; error?: string };

export default function MolliePaymentSettings({ configured }: { configured: boolean }) {
  const [data, setData] = useState<Result | null>(null);
  const [selection, setSelection] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!configured) return;
    fetch("/api/mollie/profiles", { cache: "no-store" })
      .then(async r => r.json() as Promise<Result>).then(value => {
        setData(value); setSelection(value.profileId || "");
      }).catch(() => setNotice("Profielen ophalen is niet gelukt."));
  }, [configured]);
  async function save() {
    setNotice("");
    const response = await fetch("/api/mollie/profiles", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: selection }) });
    setNotice(response.ok ? "Betaalprofiel opgeslagen." : "Betaalprofiel opslaan mislukt.");
  }
  return <section className="rounded-lg border border-[#eadfda] bg-white p-6 space-y-3">
    <h2 className="text-xl font-semibold text-[#33243b]">Online betalingen via Mollie</h2>
    <p className="text-sm text-[#726671]">Klanten krijgen bij een factuur een veilige betaallink.
      Wero is beschikbaar wanneer Mollie het voor jouw bedrijf heeft geactiveerd.
      Betalingen komen op je eigen Mollie-account binnen.</p>
    {!configured ? <p className="text-sm text-[#726671]">De koppeling wordt voorbereid en is nog niet beschikbaar.</p> :
      <>
        <p className="text-sm">{data?.connected ? "Mollie-account gekoppeld." : "Nog geen Mollie-account gekoppeld."}</p>
        <a href="/api/mollie/connect" className="inline-block font-semibold text-[#543749] underline">
          {data?.connected ? "Mollie opnieuw koppelen" : "Koppel jouw Mollie-account"}</a>
        {data?.connected && data.profiles && data.profiles.length > 0 ? <div className="space-y-2">
          <label htmlFor="mollie-profile" className="block text-sm font-medium">Betaalprofiel</label>
          <select id="mollie-profile" className="input" value={selection}
            onChange={event => setSelection(event.target.value)}>
            <option value="">Kies een betaalprofiel</option>
            {data.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name} ({profile.status})</option>)}
          </select>
          <button type="button" className="btn-primary" onClick={save} disabled={!selection}>Profiel opslaan</button>
        </div> : null}
      </>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <p className="text-xs text-[#726671]">Time2Pay bewaart geen betaalkaartgegevens. Automatisch betaald melden gebeurt pas na verificatie bij Mollie.</p>
  </section>;
}
