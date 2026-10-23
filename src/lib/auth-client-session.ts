"use client";

export class SessionError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export async function startSession(idToken: string) {
  const response = await fetch("/api/auth/session", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (response.ok) return;
  const body = await response.json().catch(() => ({}));
  throw new SessionError(body.error ?? "session_failed", body.message ?? "Inloggen is niet gelukt. Probeer opnieuw.");
}
