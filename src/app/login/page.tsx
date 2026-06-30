"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Lock, Mail } from "lucide-react";
import toast from "react-hot-toast";
import { signInWithEmailAndPassword, type AuthError } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";

function mapFirebaseError(code?: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "Ongeldig e-mailadres.";
    case "auth/user-disabled":
      return "Dit account is uitgeschakeld.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "E-mailadres of wachtwoord is onjuist.";
    case "auth/too-many-requests":
      return "Te veel pogingen. Probeer het later opnieuw.";
    case "auth/network-request-failed":
      return "Geen netwerkverbinding.";
    default:
      return "Inloggen mislukt. Probeer het opnieuw.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get("next") || "/dashboard");
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Vul je e-mailadres en wachtwoord in.");
      return;
    }

    setSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error("session_failed");
      }

      toast.success("Welkom terug.");
      router.push(nextPath);
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
          <h1 className="text-2xl font-bold text-gray-900">Welkom terug</h1>
          <p className="mt-2 text-sm text-gray-500">Log in om je facturen te beheren.</p>
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
                  autoComplete="current-password"
                  className="input pl-9"
                  placeholder="Minimaal 8 tekens"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-2.5">
              {submitting ? "Bezig met inloggen..." : (
                <>
                  Inloggen <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Nog geen account?{" "}
          <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-700">
            Registreren
          </Link>
        </p>
      </div>
    </div>
  );
}
