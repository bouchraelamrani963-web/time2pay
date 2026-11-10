import Link from "next/link";
export default function PaymentReturnPage() {
  return <main className="mx-auto max-w-xl px-6 py-20 text-center">
    <h1 className="text-2xl font-semibold text-[#33243b]">De betaling wordt gecontroleerd</h1>
    <p className="mt-4 text-[#726671]">Je bent teruggekeerd van de betaalpagina. Alleen na de bevestiging
      van Mollie kan de factuur als betaald worden aangemerkt. Bij vragen kun je contact opnemen
      met de afzender van de factuur.</p>
    <Link href="/" className="mt-6 inline-block underline">Terug naar Time2Pay</Link>
  </main>;
}
