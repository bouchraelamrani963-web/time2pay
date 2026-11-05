import { trialPresentation } from "@/lib/registration-trial-policy";
import Link from "next/link";
import LandingHero from "./LandingHero";
import BrandLogo from "./BrandLogo";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";

const steps = [
  {
    title: "Voeg je klant toe",
    description: "Bewaar klantgegevens op één plek. Je hoeft ze niet steeds opnieuw in te vullen.",
  },
  {
    title: "Vul je werk in",
    description: "Bereken de kosten op basis van uren, vierkante meters, materiaal of een vaste prijs.",
  },
  {
    title: "Maak je factuur",
    description: "Maak een overzichtelijke factuur, download de PDF en volg de betaalstatus.",
  },
];

const features = [
  {
    title: "Facturen op jouw manier",
    description: "Factureer per uur, m², materiaal of vaste prijs. Alle posten netjes bij elkaar.",
  },
  {
    title: "Klanten bij de hand",
    description: "Een overzicht met klantgegevens die je meteen kunt gebruiken bij een nieuwe factuur.",
  },
  {
    title: "Zie wat nog openstaat",
    description: "Houd bij welke facturen betaald zijn en welke nog aandacht nodig hebben.",
  },
  {
    title: "Professionele PDF's",
    description: "Een duidelijk document dat je kunt downloaden, printen of naar je klant versturen.",
  },
  {
    title: "Inzicht zonder zoeken",
    description: "Bekijk je omzet, je openstaande bedragen en je recente facturen in één overzicht.",
  },
  {
    title: "Betalingen opvolgen",
    description: "Houd vervaldatums in de gaten en stuur een herinnering wanneer dat nodig is.",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "€ 9",
    description: "Voor wie eenvoudig wil beginnen.",
    details: ["Tot 30 facturen per abonnementsperiode", "Basis klantbeheer", "PDF downloaden", "Dashboard overzicht"],
    href: "/register?plan=starter",
    action: "Kies Starter",
  },
  {
    name: "Pro",
    price: "€ 19",
    description: "Voor zelfstandigen met een volle agenda.",
    details: ["Betalingsherinneringen", "Omzet- en betaalinzichten"],
    href: "/register?plan=pro",
    action: "Kies Pro",
  },
  {
    name: "Business",
    price: "€ 39",
    description: "Voor kleine teams en groeiende bedrijven.",
    details: ["Prioriteit support", "Hulp bij inrichting"],
    href: "/register?plan=business",
    action: "Kies Business",
  },
];

export default function LandingPage({ trialEnabled = false, launchOffer = false, trialCopy = trialPresentation(trialEnabled) }: { trialEnabled?: boolean; launchOffer?: boolean; trialCopy?: ReturnType<typeof trialPresentation> }) {
  return (
    <div className="min-h-screen bg-[#fbf8f5] text-[#342b39]">
      <main>
        <LandingHero trialCopy={trialCopy} />

        <section id="how-it-works" className="scroll-mt-40 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
            <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr] md:gap-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a624d]">Zo werkt het</p>
                <h2 className="mt-5 max-w-sm text-3xl font-semibold leading-tight tracking-[-0.035em] text-[#342b39] sm:text-4xl">
                  Minder administratie.<br />Meer overzicht.
                </h2>
              </div>
              <p className="max-w-lg text-base leading-8 text-[#746a70] md:pt-10">
                Een factuur maken hoeft geen apart project te zijn. Je volgt gewoon drie overzichtelijke stappen.
              </p>
            </div>
            <div className="mt-14 grid gap-9 border-t border-[#e9deda] pt-9 md:grid-cols-3 md:gap-12">
              {steps.map((step) => (
                <div key={step.title}>
                  <h3 className="text-xl font-semibold tracking-tight text-[#342b39]">{step.title}</h3>
                  <p className="mt-3 max-w-sm text-sm leading-7 text-[#766a73]">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-40 border-y border-[#e9deda] bg-[#fbf8f5] py-20 sm:py-28">
          <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
            <div className="mb-14 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a624d]">De mogelijkheden</p>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Alles bij elkaar. Zonder onnodige stappen.</h2>
            </div>
            <div className="grid gap-x-16 md:grid-cols-2">
              {features.map((feature) => (
                <div key={feature.title} className="border-t border-[#e9deda] py-7">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-7 text-[#746a70]">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-40 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
            <div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a624d]">Prijzen</p>
                <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Kies wat bij je past.</h2>
              </div>
              <p className="max-w-xs text-sm leading-7 text-[#766a73]">Begin klein en kies de mogelijkheden die je nodig hebt.</p>
            </div>
            <div className="mb-8 rounded-md border border-[#d5c2ba] bg-[#fbf8f5] p-6 text-sm leading-7">
              <h3 className="text-lg font-semibold">{trialCopy.headline}</h3>
              <p className="mt-2">{trialCopy.detail}</p>
              <p className="mt-2">{trialCopy.after}</p>
              <p className="mt-2">Een pakketknop maakt alleen een account aan en sluit geen abonnement af.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={plan.name === "Pro"
                    ? "flex flex-col border border-[#cdb8b2] bg-[#f8f0eb] p-7 sm:p-8"
                    : "flex flex-col border border-[#ebe0dd] bg-white p-7 sm:p-8"}
                >
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <p className="mt-2 min-h-[46px] text-sm leading-6 text-[#766a73]">{plan.description}</p>
                  <div className="mt-7 flex items-end gap-2 border-b border-[#e9deda] pb-7">
                    <span className="text-4xl font-semibold tracking-[-0.04em]">{plan.price}</span>
                    <span className="pb-1 text-xs text-[#87777d]">per maand</span>
                  </div>
                  <ul className="mt-7 flex-1 space-y-4 text-sm text-[#62545d]">
                    {plan.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-3">
                        <Check size={16} className="mt-0.5 shrink-0 text-[#9a624d]" aria-hidden />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={plan.name === "Pro"
                      ? "mt-9 inline-flex min-h-11 items-center justify-between gap-3 rounded-md bg-[#543749] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3e2937]"
                      : "mt-9 inline-flex min-h-11 items-center justify-between gap-3 rounded-md border border-[#d5c2ba] px-5 py-3 text-sm font-semibold text-[#543749] transition-colors hover:bg-[#fcf5f0]"}
                  >
                    {plan.action} <ArrowUpRight size={17} aria-hidden />
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-6 text-[#87777d]">Getoonde maandprijzen gelden voor een afzonderlijk af te sluiten betaald abonnement. Pakketkeuze bij registratie activeert geen betaling.</p>
          </div>
        </section>

        <section className="bg-[#4a3042] py-20 text-[#fbf7f4] sm:py-24">
          <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-10 px-6 sm:px-8 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#dcbba7]">Aan de slag</p>
              <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
                Je volgende factuur mag eenvoudiger.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#ecded7]">Maak een account aan en ontdek Time2Pay.</p>
            </div>
            <Link href="/register" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-md bg-[#fffaf6] px-7 py-3 text-sm font-semibold text-[#4a3042] transition-colors hover:bg-white">
              Gratis account aanmaken <ArrowRight size={17} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-[#fbf8f5]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-6 py-10 text-sm sm:px-8 md:flex-row md:items-center md:justify-between">
          <Link href="/" aria-label="Time2Pay – homepage" className="inline-flex"><BrandLogo size="footer" /></Link>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-[#786d73]">
            <a href="#how-it-works" className="hover:text-[#543749]">Werkwijze</a>
            <a href="#features" className="hover:text-[#543749]">Functies</a>
            <a href="#pricing" className="hover:text-[#543749]">Prijzen</a>
            <Link href="/login" className="hover:text-[#543749]">Inloggen</Link>
          </div>
          <span className="text-xs text-[#9a8b92]">© {new Date().getFullYear()} Time2Pay</span>
        </div>
      </footer>
    </div>
  );
}
