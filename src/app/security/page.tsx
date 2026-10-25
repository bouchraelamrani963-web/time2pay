"use client";
import Link from "next/link";
import { useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase-client";
import RecoveryCodes from "@/components/RecoveryCodes";
export default function SecurityPage() {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  async function api(path: string, body: object) {
    const user = getFirebaseAuth().currentUser;
    if (!user) throw new Error("Log eerst opnieuw in met je wachtwoord en authenticator.");
    const response = await fetch("/api/auth/recovery/" + path, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, idToken: await user.getIdToken(true) }) });
    const result = await response.json();
    if (!response.ok) throw new Error("Deze actie vereist een recente login met je authenticator, of is nog niet vrijgegeven. Log opnieuw in en probeer het dan opnieuw.");
    return result;
  }
  async function createCodes() {
    setBusy(true); setMessage("");
    try {
      setCodes((await api("codes", {})).recoveryCodes);
    } catch (error) { setMessage(error instanceof Error ? error.message : "De beveiligingsactie is niet gelukt."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-xl space-y-6 px-5 py-12">
    <h1 className="text-3xl font-semibold">Beveiliging en herstel</h1>
    <p>Je beveiligt je account met één authenticator-app. Bewaar je tien eenmalige herstelcodes op een veilige plek voor als je geen toegang meer hebt tot die app.</p>
    <p>Log voor wijzigingen opnieuw in met je wachtwoord en authenticator. Een bevestigingsmail is geen tweede inlogfactor.</p>
    {codes.length ? <RecoveryCodes codes={codes} onDone={() => setCodes([])} /> : <>
      <p>Bij nieuwe herstelcodes vervallen alle oude codes meteen. De nieuwe codes worden één keer getoond.</p>
      <button disabled={busy} onClick={createCodes} className="rounded border px-4 py-3">Nieuwe herstelcodes maken</button>
    </>}
    <p role="status">{message}</p>
    <p><Link className="underline" href="/login?next=/security">Opnieuw inloggen</Link></p>
    <p><Link className="underline" href="/dashboard">Terug naar dashboard</Link></p>
  </main>;
}
