"use client";

import { useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Lock, Mail, User } from "lucide-react";
import toast from "react-hot-toast";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Onbekende fout";
}

function formatUnknownError(error: unknown): string {
  const code = errorCode(error) ?? "geen-code";
  return `Onbekende fout (${code}): ${errorMessage(error)}`;
}

function mapFirebaseError(error: unknown): string {
  const code = errorCode(error);
  switch (code) {
    case "auth/email-already-in-use":
      return `Dit e-mailadres is al in gebruik. (${code})`;
    case "auth/weak-password":
      return `Wachtwoord is te zwak. Gebruik minimaal 8 tekens. (${code})`;
    case "auth/invalid-email":
      return `Ongeldig e-mailadres. (${code})`;
    case "auth/operation-not-allowed":
      return `E-mail/wachtwoord registratie is niet ingeschakeld in Firebase. (${code})`;
    case "auth/unauthorized-domain":
      return `Dit domein is niet toegestaan in Firebase Authentication. (${code})`;
    case "auth/api-key-not-valid":
      return `De Firebase API key is ongeldig of ontbreekt. (${code})`;
    case "auth/network-request-failed":
      return `Geen netwerkverbinding met Firebase. (${code})`;
    case "time2pay/missing-firebase-client-env":
      return `${errorMessage(error)} (${code})`;
    default:
      return formatUnknownError(error);
  }
}

async function startSession(idToken: string) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (response.ok) return;

  const responseBody = await response.text().catch(() => "");
  console.error("[register session failed]", {
    status: response.status,
    body: responseBody,
  });

  throw new Error(`session_failed:${response.status}:${responseBody || "geen response body"}`);
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Vul je e-mailadres en wachtwoord in.");
      return;
    }

    if (password.length < 8) {
      setError("Wachtwoord moet minimaal 8 tekens bevatten.");
      return;
    }

    setSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);

      if (name.trim()) {
        await updateProfile(credential.user, { displayName: name.trim() });
      }

      const idToken = await credential.user.getIdToken(true);
      try {
        await startSession(idToken);
      } catch (sessionError) {
        setError(`Account aangemaakt, maar sessie kon niet worden gestart. ${errorMessage(sessionError)}`);
        setSubmitting(false);
        return;
      }

      toast.success("Account aangemaakt. Welkom.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(mapFirebaseError(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center bg-[#fbf8f5] px-4 py-16 sm:py-20">
      <div className="w-full max-w-[460px]">
        <div className="mb-9 text-center">
          <Link href="/" aria-label="Time2Pay – homepage" className="mb-8 inline-flex items-center justify-center"><BrandLogo size="auth" /></Link>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#33243b]">Account aanmaken</h1>
          <p className="mt-2 text-sm text-[#776c74]">
            Maak je account aan om Time2Pay te ontdekken.
          </p>
        </div>

        <div className="border border-[#eadfda] bg-white p-8 shadow-[0_18px_45px_-38px_rgba(56,37,52,0.28)] sm:p-10">
          <form onSubmit={onSubmit} className="space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="name" className="mb-2 block text-xs font-semibold text-[#534653]">Naam</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a89ca0]" />
                <input
                  id="name"
                  autoComplete="name"
                  className="block w-full rounded-md border border-[#e1d5d2] bg-[#fefdfb] px-4 py-3 pl-10 text-sm text-[#33243b] outline-none transition-colors placeholder:text-[#aa9ea2] focus:border-[#9a624d] focus:ring-2 focus:ring-[#9a624d]/15"
                  placeholder="Jan de Vries"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-semibold text-[#534653]">E-mailadres</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a89ca0]" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="block w-full rounded-md border border-[#e1d5d2] bg-[#fefdfb] px-4 py-3 pl-10 text-sm text-[#33243b] outline-none transition-colors placeholder:text-[#aa9ea2] focus:border-[#9a624d] focus:ring-2 focus:ring-[#9a624d]/15"
                  placeholder="naam@bedrijf.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-semibold text-[#534653]">Wachtwoord</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a89ca0]" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  className="block w-full rounded-md border border-[#e1d5d2] bg-[#fefdfb] px-4 py-3 pl-10 text-sm text-[#33243b] outline-none transition-colors placeholder:text-[#aa9ea2] focus:border-[#9a624d] focus:ring-2 focus:ring-[#9a624d]/15"
                  placeholder="Minimaal 8 tekens"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#543749] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3e2937] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#543749] disabled:opacity-60">
              {submitting ? "Bezig met aanmaken..." : (
                <>
                  Registreren <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-[#776c74]">
          Heb je al een account?{" "}
          <Link href="/login" className="font-semibold text-[#543749] hover:text-[#9a624d]">
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  );
}
