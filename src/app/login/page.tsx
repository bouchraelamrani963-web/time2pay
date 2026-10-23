"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { useRouter } from "next/navigation";
import {
  getMultiFactorResolver, multiFactor, reload, sendEmailVerification,
  signInWithEmailAndPassword, signOut, TotpMultiFactorGenerator,
  type MultiFactorError, type MultiFactorResolver, type TotpSecret, type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { startSession, SessionError } from "@/lib/auth-client-session";
import { safeNextPath } from "@/lib/auth-navigation";

const inputClass = "block w-full rounded-md border border-[#e1d5d2] bg-[#fefdfb] px-4 py-3 text-sm text-[#33243b] focus:border-[#9a624d] focus:ring-2 focus:ring-[#9a624d]/15";
const buttonClass = "w-full rounded-md bg-[#543749] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3e2937] disabled:opacity-60";

function friendlyError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (["auth/invalid-verification-code", "auth/invalid-totp-code"].includes(code)) return "Deze code klopt niet of is verlopen. Gebruik de nieuwste code uit je authenticator-app.";
  if (["auth/code-expired", "auth/invalid-multi-factor-session", "auth/session-expired", "auth/requires-recent-login"].includes(code)) return "Deze inlogpoging is verlopen. Kies opnieuw beginnen en log weer in.";
  if (code === "auth/too-many-requests") return "Te veel pogingen. Wacht even en probeer het opnieuw.";
  if (code === "auth/network-request-failed") return "Geen verbinding. Controleer je internet en probeer opnieuw.";
  if (["auth/operation-not-allowed", "auth/unsupported-first-factor"].includes(code)) return "De authenticator-koppeling is nog niet beschikbaar. Neem contact op met de beheerder.";
  if (error instanceof SessionError) return error.message;
  return "Inloggen is niet gelukt. Controleer je gegevens en probeer opnieuw.";
}

type Step = "password" | "code" | "verify-email" | "enroll";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/dashboard");
  const [wantsSetup, setWantsSetup] = useState(false);
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [factorId, setFactorId] = useState("");
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(safeNextPath(params.get("next")));
    setWantsSetup(params.get("security") === "setup");
  }, []);

  async function prepareEnrollment(user: User) {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const config = await response.json();
    if (!response.ok || config.setupEnabled !== true) {
      throw new SessionError("setup_unavailable", "De extra inlogbeveiliging wordt voorbereid. Je kunt deze nog niet koppelen. Neem contact op met de beheerder.");
    }
    setPendingUser(user);
    if (!user.emailVerified) { setStep("verify-email"); return; }
    const session = await multiFactor(user).getSession();
    const nextSecret = await TotpMultiFactorGenerator.generateSecret(session);
    setSecret(nextSecret);
    setCode("");
    setStep("enroll");
  }

  async function finishSignIn(user: User, allowSetup = true) {
    try {
      await startSession(await user.getIdToken(true));
    } catch (err) {
      if (allowSetup && err instanceof SessionError && ["mfa_setup_required", "email_verification_required"].includes(err.code)) {
        await prepareEnrollment(user);
        return;
      }
      throw err;
    }
    // Firebase's browser session is not used to authorize server requests.
    setSecret(null); setCode(""); setPendingUser(null); setResolver(null);
    router.replace(nextPath);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null); setBusy(true);
    try {
      if (step === "password") {
        if (!email.trim() || !password) throw new SessionError("missing", "Vul je e-mailadres en wachtwoord in.");
        const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
        setPassword("");
        if (wantsSetup && !multiFactor(credential.user).enrolledFactors.some(f => f.factorId === "totp")) {
          await prepareEnrollment(credential.user);
        } else {
          await finishSignIn(credential.user);
        }
      } else if (step === "code" && resolver) {
        if (!/^\d{6}$/.test(code)) throw new SessionError("invalid_code", "Vul de code van zes cijfers in.");
        const assertion = TotpMultiFactorGenerator.assertionForSignIn(factorId, code);
        const credential = await resolver.resolveSignIn(assertion);
        setCode("");
        await finishSignIn(credential.user, false);
      } else if (step === "enroll" && secret && pendingUser) {
        if (!/^\d{6}$/.test(code)) throw new SessionError("invalid_code", "Vul de code van zes cijfers in.");
        const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
        await multiFactor(pendingUser).enroll(assertion, "Time2Pay authenticator");
        setSecret(null); setCode(""); setPendingUser(null); setStep("password");
        await signOut(getFirebaseAuth());
        setNotice("Authenticator gekoppeld. Log nu opnieuw in met je wachtwoord en je nieuwe code.");
      }
    } catch (err) {
      if (typeof err === "object" && err !== null && "code" in err && err.code === "auth/multi-factor-auth-required") {
        const nextResolver = getMultiFactorResolver(getFirebaseAuth(), err as MultiFactorError);
        const factor = nextResolver.hints.find(hint => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        setPassword("");
        if (factor) { setResolver(nextResolver); setFactorId(factor.uid); setCode(""); setStep("code"); }
        else setError("Dit account gebruikt een andere beveiligingsmethode. Neem contact op met de beheerder.");
      } else setError(friendlyError(err));
    } finally { setBusy(false); }
  }

  async function verifyEmail(action: "send" | "check") {
    if (!pendingUser) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      if (action === "send") {
        await sendEmailVerification(pendingUser);
        setNotice("Bevestigingsmail verstuurd. Open de link in je mailbox en kies daarna ‘E-mailadres controleren’.");
      } else {
        await reload(pendingUser);
        if (!pendingUser.emailVerified) throw new SessionError("unverified", "Je e-mailadres is nog niet bevestigd.");
        await pendingUser.getIdToken(true);
        await prepareEnrollment(pendingUser);
      }
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  async function reset() {
    setBusy(true);
    try { await signOut(getFirebaseAuth()); }
    finally {
      setStep("password"); setSecret(null); setPendingUser(null); setResolver(null);
      setPassword(""); setCode(""); setError(null); setNotice(null); setBusy(false);
    }
  }

  const factors = resolver?.hints.filter(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID) ?? [];
  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center bg-[#fbf8f5] px-4 py-16 sm:py-20">
      <div className="w-full max-w-[460px]">
        <div className="mb-9 text-center">
          <Link href="/" aria-label="Time2Pay – homepage" className="mb-8 inline-flex"><BrandLogo size="auth" /></Link>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#33243b]">{step === "password" ? "Welkom terug" : step === "code" ? "Bevestig je login" : "Beveilig je account"}</h1>
          <p className="mt-2 text-sm text-[#776c74]">{step === "password" ? "Log in om je facturen te beheren." : step === "code" ? "Vul de code uit je authenticator-app in." : "Koppel een authenticator-app als tweede inlogstap."}</p>
        </div>
        <div className="border border-[#eadfda] bg-white p-8 shadow-[0_18px_45px_-38px_rgba(56,37,52,0.28)] sm:p-10">
          <form onSubmit={submit} className="space-y-5">
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {notice && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">{notice}</p>}
            {step === "password" && <>
              <div><label htmlFor="email" className="mb-2 block text-sm">E-mailadres</label><input id="email" type="email" autoComplete="email" required className={inputClass} value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div><label htmlFor="password" className="mb-2 block text-sm">Wachtwoord</label><input id="password" type="password" autoComplete="current-password" required className={inputClass} value={password} onChange={e => setPassword(e.target.value)} /></div>
            </>}
            {step === "verify-email" && <div className="space-y-4 text-sm">
              <p>Bevestig eerst {pendingUser?.email}. Daarna kun je je authenticator koppelen.</p>
              <button type="button" className={buttonClass} disabled={busy} onClick={() => verifyEmail("send")}>Bevestigingsmail versturen</button>
              <button type="button" className={buttonClass} disabled={busy} onClick={() => verifyEmail("check")}>E-mailadres controleren</button>
            </div>}
            {step === "enroll" && secret && <div className="space-y-3 text-sm">
              <p>Open je authenticator-app, voeg een account toe en kies ‘Instelsleutel invoeren’. Gebruik de naam Time2Pay en kies een tijdgebonden code.</p>
              <p>Instelsleutel (bewaar deze privé):</p>
              <code className="block break-all rounded bg-[#fbf8f5] p-3 select-all">{secret.secretKey}</code>
              <p>Bewaar de hersteloptie van je authenticator veilig voordat je doorgaat. Zonder toegang tot je app kun je niet inloggen. Herstel via de beheerder vereist identiteitscontrole.</p>
            </div>}
            {step === "code" && factors.length > 1 && <div>
              <label htmlFor="factor" className="mb-2 block text-sm">Authenticator</label>
              <select id="factor" value={factorId} onChange={e => { setFactorId(e.target.value); setCode(""); }} className={inputClass}>
                {factors.map((factor, i) => <option key={factor.uid} value={factor.uid}>{factor.displayName || `Authenticator ${i + 1}`}</option>)}
              </select>
            </div>}
            {(step === "code" || step === "enroll") && <div>
              <label htmlFor="code" className="mb-2 block text-sm">Autorisatiecode</label>
              <input key={step} id="code" autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className={inputClass} aria-describedby="code-help" />
              <p id="code-help" className="mt-2 text-xs text-[#776c74]">Zes cijfers uit je authenticator-app. Deel deze code met niemand.</p>
            </div>}
            {step !== "verify-email" && <button type="submit" disabled={busy} className={buttonClass}>{busy ? "Even controleren..." : step === "password" ? "Inloggen" : step === "enroll" ? "Authenticator koppelen" : "Code bevestigen"}</button>}
            {step !== "password" && <button type="button" disabled={busy} onClick={reset} className="w-full text-sm text-[#543749] underline">Opnieuw beginnen</button>}
            {step === "code" && <p className="text-xs text-[#776c74]">Geen toegang tot je authenticator? Neem contact op met de beheerder voor veilig accountherstel.</p>}
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-[#776c74]">Nog geen account? <Link href="/register" className="font-semibold text-[#543749]">Registreren</Link></p>
      </div>
    </div>
  );
}
