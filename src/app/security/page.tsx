"use client";
import Link from "next/link";
import { useState } from "react";
import { multiFactor, signOut, TotpMultiFactorGenerator, type TotpSecret } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
import TotpEnrollment from "@/components/TotpEnrollment";
import RecoveryCodes from "@/components/RecoveryCodes";
export default function SecurityPage() {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [codes, setCodes] = useState<string[]>([]), [secret, setSecret] = useState<TotpSecret | null>(null), [code, setCode] = useState("");
  async function api(path: string, body: object) {
    const user = getFirebaseAuth().currentUser;
    if (!user) throw new Error("Log eerst opnieuw in met je wachtwoord en authenticator.");
    const response = await fetch("/api/auth/recovery/" + path, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, idToken: await user.getIdToken(true) }) });
    const result = await response.json();
    if (!response.ok) throw new Error("Deze actie vereist een recente login met je authenticator, of is nog niet vrijgegeven. Log opnieuw in en probeer het dan opnieuw.");
    return result;
  }
  async function perform(action: "codes" | "backup" | "confirm") {
    setBusy(true); setMessage("");
    try {
      if (action === "codes") setCodes((await api("codes", {})).recoveryCodes);
      else if (action === "backup") {
        await api("backup", { action: "prepare" });
        const session = await multiFactor(getFirebaseAuth().currentUser!).getSession();
        setSecret(await TotpMultiFactorGenerator.generateSecret(session));
      } else if (secret) {
        if (!/^\d{6}$/.test(code)) throw new Error("Vul zes cijfers uit de reserve-app in.");
        const user = getFirebaseAuth().currentUser!;
        await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret, code), "Time2Pay reserve-authenticator");
        setSecret(null); setCode("");
        await api("backup", { action: "complete" });
        await signOut(getFirebaseAuth());
        await fetch("/api/auth/session", { method: "DELETE" });
        setMessage("Reserve-authenticator gekoppeld. Alle sessies zijn ingetrokken. Log opnieuw in en controleer beide authenticators.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "De beveiligingsactie is niet gelukt."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-xl space-y-6 px-5 py-12">
    <h1 className="text-3xl font-semibold">Beveiliging en herstel</h1>
    <p>Log voor wijzigingen opnieuw in met je wachtwoord en authenticator. Een bevestigingsmail is geen tweede inlogfactor.</p>
    {codes.length ? <RecoveryCodes codes={codes} onDone={() => setCodes([])} /> : <>
      <p>Bij nieuwe herstelcodes vervallen alle oude codes meteen. De nieuwe codes worden één keer getoond.</p>
      <button disabled={busy} onClick={() => perform("codes")} className="rounded border px-4 py-3">Nieuwe herstelcodes maken</button>
    </>}
    <div><button disabled={busy || !!secret} onClick={() => perform("backup")} className="rounded border px-4 py-3">Reserve-authenticator koppelen</button></div>
    {secret && <form className="space-y-4" onSubmit={e => { e.preventDefault(); perform("confirm"); }}>
      <TotpEnrollment secret={secret} accountName={getFirebaseAuth().currentUser?.email || "Time2Pay reserve"} />
      <label>Code uit reserve-app<input required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0,6))} className="block rounded border p-3" /></label>
      <button disabled={busy} className="rounded bg-[#543749] px-4 py-3 text-white">Reserve bevestigen</button>
    </form>}
    <p role="status">{message}</p>
    <p><Link className="underline" href="/login?next=/security">Opnieuw inloggen</Link></p>
    <p><Link className="underline" href="/dashboard">Terug naar dashboard</Link></p>
  </main>;
}
