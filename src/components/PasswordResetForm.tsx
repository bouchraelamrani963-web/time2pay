"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { PASSWORD_RESET_NOTICE, passwordResetError } from "@/lib/password-reset-policy";

export default function PasswordResetForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || sent) return;
    sending.current = true;
    setBusy(true); setError(null);
    try {
      // Use the existing Firebase project and its configured email action handler.
      // This never signs in, creates an app session or changes an MFA factor.
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
      setSent(true); setEmail("");
    } catch (cause) {
      const message = passwordResetError(cause);
      if (message) setError(message);
      else { setSent(true); setEmail(""); }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return <div className="space-y-5">
    <p>Vraag een e-mail aan waarmee je zelf een nieuw wachtwoord kunt instellen.</p>
    <p className="text-sm text-[#776c74]">Dit herstelt alleen je wachtwoord. Voor een gekoppelde authenticator blijven je authenticatorcode of de aparte herstelprocedure nodig.</p>
    {sent ? <p role="status" className="rounded border border-green-200 bg-green-50 p-4 text-green-900">{PASSWORD_RESET_NOTICE}</p> :
      <form onSubmit={submit} className="space-y-5">
        {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
        <div>
          <label htmlFor="reset-email" className="mb-2 block text-sm">E-mailadres</label>
          <input id="reset-email" required type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy}
            className="block w-full rounded border border-[#e1d5d2] bg-[#fefdfb] px-4 py-3 text-[#33243b] focus:ring-2 focus:ring-[#9a624d]/15" />
        </div>
        <button type="submit" disabled={busy} className="w-full rounded bg-[#543749] px-5 py-3 font-semibold text-white hover:bg-[#3e2937] disabled:opacity-60">
          {busy ? "Aanvragen..." : "Herstelmail aanvragen"}
        </button>
      </form>}
    <p><Link href="/login" className="text-[#543749] underline">Terug naar inloggen</Link></p>
    <p><Link href="/recover" className="text-sm text-[#543749] underline">Geen toegang tot je authenticator?</Link></p>
  </div>;
}
