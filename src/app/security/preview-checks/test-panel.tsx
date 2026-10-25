"use client";
import { useEffect, useState } from "react";
type Result = { attempts: number; accepted: boolean; failed: boolean; retryScheduled: boolean };
export default function PreviewNoticeCheck() {
  const [id, setId] = useState(""), [busy, setBusy] = useState(false), [result, setResult] = useState<Result | null>(null), [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch("/api/auth/recovery/notice-check?id=" + encodeURIComponent(id), { cache: "no-store" });
        if (!response.ok) throw Error();
        const data: Result = await response.json();
        if (!stopped) { setResult(data); if (!data.accepted && !data.failed) timer = setTimeout(poll, 5000); }
      } catch { if (!stopped) setError("Statuscontrole mislukt. Controleer je login en probeer opnieuw."); }
    }
    poll(); return () => { stopped = true; clearTimeout(timer); };
  }, [id]);
  async function start() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/recovery/notice-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw Error();
      setId((await response.json()).id);
    } catch { setError("De proef kon niet starten. Controleer je login en de Preview-instellingen."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-xl space-y-4 p-6">
    <h1 className="text-2xl font-semibold">Preview: beveiligingsmelding testen</h1>
    <p>Deze proef veroorzaakt één gecontroleerde verzendfout. De achtergrondtaak hoort de testmelding na ongeveer één minuut automatisch opnieuw te proberen en naar de testontvanger te sturen.</p>
    <button disabled={busy || !!id} onClick={start} className="rounded border p-3">Start herhaalproef</button>
    <p role="status">{result ? result.accepted ? `Geslaagd: verzenddienst heeft de melding geaccepteerd na ${result.attempts} pogingen.` : result.failed ? "Proef mislukt: handmatige controle nodig." : result.retryScheduled ? `Verzendfout vastgelegd; automatische herhaling gepland. Pogingen: ${result.attempts}.` : `Proef loopt. Pogingen: ${result.attempts}.` : ""}</p>
    {error && <p role="alert">{error}</p>}
  </main>;
}
