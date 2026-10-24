import type { Metadata } from "next";
import { recoveryEnabled } from "@/lib/recovery-config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Veilig accountherstel — Time2Pay", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function RecoveryLayout({ children }: { children: React.ReactNode }) {
  return recoveryEnabled() ? children : <main className="mx-auto max-w-xl p-10"><h1>Accountherstel wordt voorbereid</h1><p>Deze functie is nog niet vrijgegeven. Je bestaande authenticator blijft nodig om in te loggen.</p></main>;
}
