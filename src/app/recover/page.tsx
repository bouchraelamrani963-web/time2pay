"use client";
import Link from "next/link";
import { useState } from "react";
const input = "block w-full rounded border border-[#e1d5d2] px-3 py-3";
export default function RecoveryPage() {
  const [support, setSupport] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [code, setCode] = useState(""), [contact, setContact] = useState(""), [description, setDescription] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/recovery/" + (support ? "support" : "start"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, recoveryCode: code, contactEmail: contact, description }),
      });
      setPassword(""); setCode("");
      const result = await response.json();
      if (!response.ok) { setMessage(result.message || "Herstel is niet gelukt."); return; }
      if (support) setMessage("Je verzoek is vastgelegd. Bewaar referentie " + result.reference + ". Dit geeft nog geen toegang. Zonder betrouwbaar bewijs van eigenaarschap wordt je verzoek afgewezen.");
      else window.location.assign("/login?security=setup");
    } catch { setPassword(""); setCode(""); setMessage("Geen verbinding. Probeer opnieuw of neem contact op met support. Een onderbroken herstelstap geeft geen toegang."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-xl space-y-6 px-5 py-12">
    <h1 className="text-3xl font-semibold">Geen toegang tot je authenticator?</h1>
    <p>Gebruik je wachtwoord en één ongebruikte herstelcode. Daarna koppel je een nieuwe authenticator en log je opnieuw in. Bestaande sessies worden ingetrokken.</p>
    <form onSubmit={submit} className="space-y-4 rounded border bg-white p-6">
      <label className="block">E-mailadres<input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className={input} maxLength={254} /></label>
      <label className="block">Wachtwoord<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={input} maxLength={4096} /></label>
      {!support ? <label className="block">Herstelcode<input required type="text" autoComplete="off" spellCheck={false} value={code} onChange={e => setCode(e.target.value)} className={input + " font-mono"} maxLength={64} /></label> : <>
        <p>Support kan alleen helpen na onafhankelijke, betrouwbare identiteitscontrole. Alleen e-mailtoegang, persoonsgegevens of wachten is onvoldoende.</p>
        <label className="block">Contactadres<input required type="email" autoComplete="email" value={contact} onChange={e => setContact(e.target.value)} className={input} maxLength={254} /></label>
        <label className="block">Wat is er gebeurd?<textarea required value={description} onChange={e => setDescription(e.target.value)} className={input} maxLength={1500} /></label>
        <p className="text-sm">Stuur geen wachtwoorden, codes, bankgegevens of kopieën van identiteitsdocumenten mee. Dit formulier voert geen reset uit.</p>
      </>}
      <p role="status" aria-live="polite">{message}</p>
      <button disabled={busy} className="rounded bg-[#543749] px-4 py-3 text-white disabled:opacity-50">{busy ? "Controleren..." : support ? "Herstelverzoek indienen" : "Nieuwe authenticator instellen"}</button>
    </form>
    <button type="button" disabled={busy} className="underline" onClick={() => { setSupport(!support); setCode(""); setPassword(""); setMessage(""); }}>{support ? "Ik heb wel een herstelcode" : "Ook je herstelcodes kwijt? Vraag support om hulp"}</button>
    <p><Link href="/login" className="underline">Terug naar inloggen</Link></p>
  </main>;
}
