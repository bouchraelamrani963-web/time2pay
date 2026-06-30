import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-1">
            <span className="text-3xl font-black tracking-tight text-blue-600">Time</span>
            <span className="text-3xl font-black tracking-tight text-gray-900">2Pay</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Inloggen</h1>
          <p className="mt-2 text-sm text-gray-500">
            De inlogomgeving wordt gekoppeld aan je Time2Pay-account.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-md">
          <p className="text-sm leading-6 text-gray-600">
            Je accountomgeving is bijna klaar. Ga terug naar de homepage of start alvast gratis met Time2Pay.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/" className="btn-secondary justify-center">
              Terug naar homepage
            </Link>
            <Link href="/register" className="btn-primary justify-center">
              Gratis starten
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
