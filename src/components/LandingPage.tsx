import Link from "next/link";
import BrandLogo from "./BrandLogo";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Voeg je klant toe",
    description: "Bewaar klantgegevens op één plek. Je hoeft ze niet steeds opnieuw in te vullen.",
  },
  {
    number: "02",
    title: "Vul je werk in",
    description: "Bereken de kosten op basis van uren, vierkante meters, materiaal of een vaste prijs.",
  },
  {
    number: "03",
    title: "Maak je factuur",
    description: "Maak een overzichtelijke factuur, download de PDF en volg de betaalstatus.",
  },
];

const features = [
  {
    number: "01",
    title: "Facturen op jouw manier",
    description: "Factureer per uur, m², materiaal of vaste prijs. Alle posten netjes bij elkaar.",
  },
  {
    number: "02",
    title: "Klanten bij de hand",
    description: "Een overzicht met klantgegevens die je meteen kunt gebruiken bij een nieuwe factuur.",
  },
  {
    number: "03",
    title: "Zie wat nog openstaat",
    description: "Houd bij welke facturen betaald zijn en welke nog aandacht nodig hebben.",
  },
  {
    number: "04",
    title: "Professionele PDF's",
    description: "Een duidelijk document dat je kunt downloaden, printen of naar je klant versturen.",
  },
  {
    number: "05",
    title: "Inzicht zonder zoeken",
    description: "Bekijk je omzet, je openstaande bedragen en je recente facturen in één overzicht.",
  },
  {
    number: "06",
    title: "Betalingen opvolgen",
    description: "Houd vervaldatums in de gaten en stuur een herinnering wanneer dat nodig is.",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "€ 9",
    description: "Voor wie eenvoudig wil beginnen.",
    details: ["Tot 30 facturen per maand", "Basis klantbeheer", "PDF downloaden", "Dashboard overzicht"],
    href: "/register?plan=starter",
    action: "Kies Starter",
  },
  {
    name: "Pro",
    price: "€ 19",
    description: "Voor zelfstandigen met een volle agenda.",
    details: ["Onbeperkt facturen", "Onbeperkt klanten", "Betalingsherinneringen", "Omzet- en betaalinzichten"],
    href: "/register?plan=pro",
    action: "Kies Pro",
  },
  {
    name: "Business",
    price: "€ 39",
    description: "Voor kleine teams en groeiende bedrijven.",
    details: ["Meerdere gebruikers", "Uitgebreide rapportage", "Prioriteit support", "Hulp bij inrichting"],
    href: "/register?plan=business",
    action: "Kies Business",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fbf8f5] text-[#342b39]">
      <main>
        <section className="border-b border-[#e9deda]">
          <div className="mx-auto grid max-w-[1240px] gap-14 px-6 pb-20 pt-16 sm:px-8 md:pb-28 md:pt-24 lg:grid-cols-[0.96fr_1.04fr] lg:items-center lg:gap-20">
            <div className="max-w-[570px]">
              <div className="mb-9 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a624d]">
                <span className="h-px w-9 bg-[#9a624d]" />
                Facturatie voor zelfstandigen
              </div>
              <h1 className="max-w-[600px] text-[clamp(3rem,5vw,5rem)] font-semibold leading-[1.08] tracking-[-0.045em] text-[#33243b]">
                Je werk gedaan.<br />
                Je factuur geregeld.
              </h1>
              <p className="mt-8 max-w-[490px] text-lg leading-[1.8] text-[#726771]">
                Uren, materialen of vierkante meters factureren? Met Time2Pay maak je een duidelijke factuur en houd je overzicht over je klanten en betalingen.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-6">
                <Link
                  href="#pricing"
                  className="inline-flex min-h-12 items-center justify-center gap-3 rounded-md bg-[#543749] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3e2937] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#543749]"
                >
                  Bekijk abonnementen <ArrowRight size={17} aria-hidden />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-12 items-center gap-2 border-b border-[#ad8977] text-sm font-semibold text-[#543749] transition-colors hover:border-[#342b39] hover:text-[#342b39]"
                >
                  Bekijk hoe het werkt <ArrowUpRight size={16} aria-hidden />
                </a>
              </div>
              <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 border-t border-[#e9deda] pt-6 text-xs text-[#736c70]">
                <span>Gemaakt voor Nederlandse ondernemers</span>
                <span>Een account aanmaken kan zonder betaalgegevens</span>
              </div>
            </div>

            <div className="w-full min-w-0">
              <div className="mb-4 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#897d83]">
                <span>Zo ziet een factuur eruit</span>
                <span>Voorbeeld</span>
              </div>
              <div className="border border-[#e9deda] bg-white px-5 py-7 shadow-[0_20px_70px_-45px_rgba(20,44,30,0.3)] sm:px-9 sm:py-10">
                <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[#ece5e1] pb-9">
                  <div>
                    <p className="text-xs font-bold tracking-tight text-[#543749]">TIME<span className="text-[#b38974]">2</span>PAY</p>
                    <p className="mt-2 text-xs text-[#9a8b8f]">Voorbeeldfactuur</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[26px] font-semibold tracking-[-0.045em] text-[#33243b] sm:text-[32px]">Factuur</p>
                    <p className="mt-1 text-xs text-[#897d83]">F2026-0148</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5 py-8 text-sm">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#928288]">Factuur aan</p>
                    <p className="font-semibold text-[#392e3b]">Studio Van Dijk</p>
                    <p className="mt-1 text-xs text-[#887e82]">Voorbeeldklant</p>
                  </div>
                  <div className="text-right">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#928288]">Factuurdatum</p>
                    <p className="font-medium text-[#392e3b]">22 oktober 2026</p>
                    <p className="mt-1 text-xs text-[#887e82]">Betaling binnen 14 dagen</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[340px] text-left text-xs">
                    <thead>
                      <tr className="border-y border-[#ece5e1] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#95858b]">
                        <th className="py-3 font-semibold">Omschrijving</th>
                        <th className="py-3 text-right font-semibold">Aantal</th>
                        <th className="py-3 text-right font-semibold">Bedrag</th>
                      </tr>
                    </thead>
                    <tbody className="text-[#5e525c]">
                      <tr className="border-b border-[#f1eae6]">
                        <td className="py-4">Schilderwerk woonkamer <span className="block pt-1 text-[11px] text-[#94888b]">Per m²</span></td>
                        <td className="py-4 text-right">24</td>
                        <td className="py-4 text-right font-medium">€ 540,00</td>
                      </tr>
                      <tr className="border-b border-[#f1eae6]">
                        <td className="py-4">Materiaalkosten</td>
                        <td className="py-4 text-right">1</td>
                        <td className="py-4 text-right font-medium">€ 125,00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="ml-auto mt-7 max-w-[250px] space-y-3 text-xs text-[#766c70]">
                  <div className="flex justify-between gap-4"><span>Subtotaal</span><span>€ 665,00</span></div>
                  <div className="flex justify-between gap-4"><span>Btw (21%)</span><span>€ 139,65</span></div>
                  <div className="flex justify-between gap-4 border-t border-[#e9deda] pt-4 text-base font-semibold text-[#342b39]"><span>Totaal</span><span>€ 804,65</span></div>
                </div>
              </div>
              <p className="mt-4 text-right text-xs text-[#9a8b8f]">Illustratief voorbeeld · geen echte klantgegevens</p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-white py-20 sm:py-28">
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
                <div key={step.number}>
                  <p className="text-sm font-semibold text-[#a2715e]">{step.number}</p>
                  <h3 className="mt-7 text-xl font-semibold tracking-tight text-[#342b39]">{step.title}</h3>
                  <p className="mt-3 max-w-sm text-sm leading-7 text-[#766a73]">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-[#e9deda] bg-[#fbf8f5] py-20 sm:py-28">
          <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
            <div className="mb-14 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a624d]">De mogelijkheden</p>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Alles bij elkaar. Zonder onnodige stappen.</h2>
            </div>
            <div className="grid gap-x-16 md:grid-cols-2">
              {features.map((feature) => (
                <div key={feature.number} className="grid grid-cols-[36px_1fr] gap-3 border-t border-[#e9deda] py-7 sm:gap-6">
                  <span className="pt-1 text-xs font-medium text-[#789182]">{feature.number}</span>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-7 text-[#746a70]">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
            <div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a624d]">Prijzen</p>
                <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Kies wat bij je past.</h2>
              </div>
              <p className="max-w-xs text-sm leading-7 text-[#766a73]">Begin klein en kies de mogelijkheden die je nodig hebt.</p>
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
            <p className="mt-5 text-xs leading-6 text-[#87777d]">De abonnementen zijn in voorbereiding. Betalingen en pakketlimieten zijn nog niet geactiveerd.</p>
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
            <Link href="#pricing" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-md bg-[#fffaf6] px-7 py-3 text-sm font-semibold text-[#4a3042] transition-colors hover:bg-white">
              Bekijk abonnementen <ArrowRight size={17} aria-hidden />
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
