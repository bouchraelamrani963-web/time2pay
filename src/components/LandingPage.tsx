import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Check,
  Download,
  FileText,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Facturen maken",
    description: "Maak nette facturen met BTW, regels voor uren, materialen, m2 of vaste prijzen.",
  },
  {
    icon: Users,
    title: "Klanten beheren",
    description: "Bewaar klantgegevens centraal en gebruik ze direct bij elke nieuwe factuur.",
  },
  {
    icon: WalletCards,
    title: "Betaalstatus volgen",
    description: "Zie meteen welke facturen betaald, openstaand of te laat zijn.",
  },
  {
    icon: BarChart3,
    title: "Omzetoverzicht",
    description: "Krijg snel inzicht in omzet, openstaande bedragen en betaalgedrag.",
  },
  {
    icon: Download,
    title: "PDF downloaden",
    description: "Download of print professionele facturen die klaar zijn voor je klant.",
  },
  {
    icon: BellRing,
    title: "Betalingsherinneringen",
    description: "Houd achterstallige betalingen zichtbaar en stuur op tijd een herinnering.",
  },
];

const invoiceRows = [
  { number: "F2026-0148", client: "Studio Van Dijk", status: "Betaald", amount: "EUR 840,00", badge: "bg-green-100 text-green-700" },
  { number: "F2026-0147", client: "Praktijk Noord", status: "Open", amount: "EUR 1.250,00", badge: "bg-orange-100 text-orange-700" },
  { number: "F2026-0146", client: "Bakker Coaching", status: "Te laat", amount: "EUR 395,00", badge: "bg-red-100 text-red-700" },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "EUR 0",
    description: "Voor starters die professioneel willen factureren.",
    features: ["Tot 5 facturen per maand", "Basis klantbeheer", "PDF downloaden", "Dashboard overzicht"],
    cta: "Gratis starten",
    href: "/register",
    featured: false,
  },
  {
    name: "Pro",
    price: "EUR 9",
    description: "Voor zelfstandigen die meer overzicht en opvolging willen.",
    features: ["Onbeperkt facturen", "Onbeperkt klanten", "Betalingsherinneringen", "Omzet- en betaalinzichten"],
    cta: "Start met Pro",
    href: "/register?plan=pro",
    featured: true,
  },
  {
    name: "Business",
    price: "Op maat",
    description: "Voor kleine teams en groeiende bedrijven.",
    features: ["Meerdere gebruikers", "Uitgebreide rapportage", "Prioriteit support", "Hulp bij inrichting"],
    cta: "Neem contact op",
    href: "/register?plan=business",
    featured: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <section className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-b from-white via-blue-50/40 to-slate-50">
        <div
          className="absolute inset-x-0 top-0 -z-0 h-[520px] bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.16),transparent_62%)]"
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-[1200px] gap-12 px-6 py-20 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm backdrop-blur">
              <Sparkles size={14} /> Voor zzp'ers, freelancers en kleine bedrijven
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-gray-950 sm:text-5xl lg:text-6xl">
              Facturen maken zonder gedoe
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              Maak professionele facturen, beheer je klanten en zie direct wat betaald of openstaand is.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary justify-center px-6 py-3 text-base">
                Gratis starten <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="btn-secondary justify-center px-6 py-3 text-base">
                Inloggen
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
              <span className="inline-flex items-center gap-2"><Check size={15} className="text-green-600" /> Geen creditcard nodig</span>
              <span className="inline-flex items-center gap-2"><Check size={15} className="text-green-600" /> Binnen enkele minuten gestart</span>
              <span className="inline-flex items-center gap-2"><Check size={15} className="text-green-600" /> Gemaakt voor Nederlandse ondernemers</span>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl shadow-blue-900/10">
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                </div>
                <span className="text-xs font-medium text-gray-400">time2pay.nl/dashboard</span>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-gray-100 bg-blue-50/60 p-4">
                    <p className="text-xs font-medium text-blue-700">Omzet deze maand</p>
                    <p className="mt-2 text-2xl font-black text-gray-950">EUR 4.900,50</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-orange-50/70 p-4">
                    <p className="text-xs font-medium text-orange-700">Openstaand</p>
                    <p className="mt-2 text-2xl font-black text-gray-950">EUR 1.245,00</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-green-50/70 p-4">
                    <p className="text-xs font-medium text-green-700">Betaald</p>
                    <p className="mt-2 text-2xl font-black text-gray-950">12</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-gray-950">Recente facturen</p>
                      <p className="text-xs text-gray-500">Demo-overzicht</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Live status</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {invoiceRows.map((row) => (
                      <div key={row.number} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_1.3fr_auto_auto] sm:items-center">
                        <span className="font-mono font-semibold text-blue-700">{row.number}</span>
                        <span className="text-gray-600">{row.client}</span>
                        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${row.badge}`}>{row.status}</span>
                        <span className="font-bold text-gray-950">{row.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wider text-blue-600">Functies</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
              Alles om sneller en professioneler betaald te worden
            </h2>
            <p className="mt-4 text-gray-600">
              Time2Pay houdt je facturen, klanten en betaalstatus overzichtelijk in een rustige SaaS-omgeving.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon size={23} />
                </div>
                <h3 className="mt-5 text-lg font-bold text-gray-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-y border-gray-200 bg-white py-20">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-blue-600">Prijzen</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
              Kies wat past bij je bedrijf
            </h2>
            <p className="mt-4 text-gray-600">Start eenvoudig en schaal op wanneer je administratie groeit.</p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-3xl border bg-white p-7 shadow-sm ${
                  plan.featured ? "border-blue-500 shadow-md ring-2 ring-blue-100" : "border-gray-200"
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-7 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                    Populair
                  </span>
                )}
                <h3 className="text-xl font-black text-gray-950">{plan.name}</h3>
                <p className="mt-2 min-h-[48px] text-sm leading-6 text-gray-600">{plan.description}</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="text-4xl font-black tracking-tight text-gray-950">{plan.price}</span>
                  {plan.price !== "Op maat" && <span className="pb-1 text-sm font-medium text-gray-500">/maand</span>}
                </div>
                <ul className="mt-7 space-y-3 text-sm text-gray-700">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check size={16} className="mt-0.5 shrink-0 text-blue-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className={`mt-8 w-full justify-center ${plan.featured ? "btn-primary" : "btn-secondary"}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-12 text-center shadow-xl shadow-blue-900/15 sm:px-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white">
              <ShieldCheck size={24} />
            </div>
            <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl">
              Klaar om je facturatie professioneel te regelen?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-blue-100">
              Start gratis en maak vandaag nog je eerste professionele factuur in Time2Pay.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-bold text-blue-700 shadow-md transition-all hover:scale-[1.02] hover:bg-blue-50">
                Gratis starten <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="inline-flex items-center justify-center rounded-lg border border-white/25 px-6 py-3 text-base font-bold text-white transition-colors hover:bg-white/10">
                Inloggen
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white py-10">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-6 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link href="/" className="flex items-center gap-1">
            <span className="text-lg font-black text-blue-600">Time</span>
            <span className="text-lg font-black text-gray-950">2Pay</span>
          </Link>
          <div className="flex flex-wrap items-center gap-5">
            <a href="#features" className="hover:text-gray-900">Functies</a>
            <a href="#pricing" className="hover:text-gray-900">Prijzen</a>
            <Link href="/login" className="hover:text-gray-900">Inloggen</Link>
            <span className="text-gray-400">© {new Date().getFullYear()} Time2Pay</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
