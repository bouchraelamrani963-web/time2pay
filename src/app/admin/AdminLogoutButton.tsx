"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

export default function AdminLogoutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function logout() {
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Logout request failed");
    } catch {
      setFailed(true);
      setPending(false);
      return;
    }

    // The server has cleared the app session. Also clear the browser's Firebase
    // state when available, then replace the protected page in browser history.
    try {
      const [{ signOut }, { getFirebaseAuth }] = await Promise.all([
        import("firebase/auth"),
        import("@/lib/firebase-client"),
      ]);
      await signOut(getFirebaseAuth());
    } catch {
      // The server logout is already complete.
    }
    window.location.replace("/login");
  }

  return <>
    <button className="btn-secondary admin-logout-button" type="button" disabled={pending} onClick={logout}>
      <LogOut size={16} aria-hidden />{pending ? "Uitloggen…" : "Uitloggen"}
    </button>
    {failed ? <p className="admin-logout-error" role="alert">Uitloggen is mislukt. Probeer het opnieuw.</p> : null}
  </>;
}
