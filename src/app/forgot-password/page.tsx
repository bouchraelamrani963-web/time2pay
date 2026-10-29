import Link from "next/link";
import PasswordResetForm from "@/components/PasswordResetForm";
import { passwordResetAvailable } from "@/lib/password-reset-policy";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return <main className="mx-auto max-w-lg space-y-6 px-5 py-12">
    <h1 className="text-3xl font-semibold text-[#33243b]">Wachtwoord vergeten?</h1>
    <div className="border border-[#eadfda] bg-white p-6 sm:p-8">
      {passwordResetAvailable(process.env) ? <PasswordResetForm /> : <>
        <p>Wachtwoordherstel is in deze omgeving niet beschikbaar.</p>
        <p className="mt-4"><Link href="/login" className="underline">Terug naar inloggen</Link></p>
      </>}
    </div>
  </main>;
}
