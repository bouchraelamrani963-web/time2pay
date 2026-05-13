import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-6xl font-black text-gray-200">404</p>
      <p className="mt-4 text-lg font-semibold text-gray-700">Pagina niet gevonden</p>
      <Link href="/" className="mt-6 btn-primary">Terug naar dashboard</Link>
    </div>
  );
}
