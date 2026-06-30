import Link from "next/link";

export default function RegisterPage() {
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
            Maak binnenkort je Time2Pay-account aan en start met professioneel factureren.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-md">
          <p className="text-sm leading-6 text-gray-600">
            Registreren wordt nu voorbereid. Wil je alvast verder kijken? Ga terug naar de homepage of log in zodra je account actief is.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/" className="btn-secondary justify-center">
              Terug naar homepage
            </Link>
            <Link href="/login" className="btn-primary justify-center">
              Inloggen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
