"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Lock, Mail, User } from "lucide-react";
import toast from "react-hot-toast";
import { createUserWithEmailAndPassword, updateProfile, type AuthError } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";

function mapFirebaseError(code?: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "Dit e-mailadres is al in gebruik.";
    case "auth/invalid-email":
      return "Ongeldig e-mailadres.";
    case "auth/weak-password":
      return "Wachtwoord is te zwak. Gebruik minimaal 8 tekens.";
    case "auth/network-request-failed":
      return "Geen netwerkverbinding.";
    default:
      return "Aanmaken mislukt. Probeer het opnieuw.";
  }
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
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error("session_failed");
      }

      toast.success("Account aangemaakt. Welkom.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const code = (err as AuthError | undefined)?.code;
      setError(mapFirebaseError(code));
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-1">
            <span className="text-3xl font-black tracking-tight text-blue-600">Time</span>
            <span className="text-3xl font-black tracking-tight text-gray-900">2Pay</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Gratis starten</h1>
          <p className="mt-2 text-sm text-gray-500">
            Maak je account aan en start met professioneel factureren.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-md">
          <form onSubmit={onSubmit} className="space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="name" className="label">Naam</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="name"
                  autoComplete="name"
                  className="input pl-9"
                  placeholder="Jan de Vries"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="label">E-mailadres</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="input pl-9"
                  placeholder="naam@bedrijf.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">Wachtwoord</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  className="input pl-9"
                  placeholder="Minimaal 8 tekens"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-2.5">
              {submitting ? "Bezig met aanmaken..." : (
                <>
                  Registreren <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Heb je al een account?{" "}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  );
}
