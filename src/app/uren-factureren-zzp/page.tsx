import type { Metadata } from "next";
import Link from "next/link";
import DemoVideoTrigger from "@/components/DemoVideoTrigger";

const url = "https://www.time2pay.nl/uren-factureren-zzp";
const title = "Uren factureren als zzp’er met voorbeeld | Time2Pay";
const description = "Zo zet je gewerkte uren op je factuur. Bekijk een voorbeeld met dag-, avond- en weekendtarieven en ontdek hoe je dit doet in Time2Pay.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: { title, description, url, type: "article", locale: "nl_NL", siteName: "Time2Pay" },
};

const example = [
  ["Installatiewerk overdag", 6, "€ 55,00", "€ 330,00"],
  ["Installatiewerk in de avond", 2, "€ 65,00", "€ 130,00"],
  ["Installatiewerk in het weekend", 3, "€ 75,00", "€ 225,00"],
] as const;

export default function UrenFacturerenPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10 text-[#342b39]">
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Uren factureren als zzp’er</h1>
        <p className="text-lg leading-8 text-[#62545d]">
          Heb je voor één klant overdag, ’s avonds en in het weekend gewerkt? Zet je uren per{" "}
          <strong>uurtarief dat je met je klant hebt afgesproken</strong> op een aparte factuurregel.
          Zo ziet je klant wat je hebt gedaan en hoe het bedrag is opgebouwd.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Van gewerkte uren naar factuur</h2>
        <ol className="list-decimal space-y-3 pl-5 leading-7">
          <li><strong>Verzamel je uren per opdracht.</strong> Noteer wanneer je hebt gewerkt en omschrijf kort wat je hebt gedaan.</li>
          <li><strong>Pak de afspraken met je klant erbij.</strong> Gebruik per regel het afgesproken dag-, avond- of weekendtarief.</li>
          <li><strong>Maak een aparte regel per tarief.</strong> Vermeld het aantal uren, het uurtarief en het bedrag per regel.</li>
          <li>
            <strong>Controleer je factuur.</strong> Vergelijk de regels met je urenoverzicht en bekijk
            welke wettelijke factuureisen voor jouw situatie gelden.{" "}
            <a className="font-medium underline underline-offset-4" href="https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/administratie_bijhouden/facturen_maken/factuureisen/">Factuureisen van de Belastingdienst</a>
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 id="urenfactuur-voorbeeld" className="text-2xl font-semibold">Voorbeeld van een urenfactuur</h2>
        <p className="leading-7">
          In dit fictieve voorbeeld heeft de zzp’er vooraf drie uurtarieven met de klant afgesproken.
          De bedragen zijn exclusief btw.
        </p>
        <div className="overflow-x-auto rounded-md border border-[#e2d8d5]">
          <table aria-labelledby="urenfactuur-voorbeeld" className="w-full text-sm [&_td]:p-2 [&_th]:p-2 sm:[&_td]:p-3 sm:[&_th]:p-3">
            <thead className="bg-[#f8f0eb]">
              <tr>
                <th scope="col" className="text-left">Werkzaamheden</th>
                <th scope="col" className="text-right">Uren</th>
                <th scope="col" className="text-right">Uurtarief</th>
                <th scope="col" className="text-right">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {example.map(([work, hours, rate, amount]) => (
                <tr key={work} className="border-t border-[#e2d8d5] text-right">
                  <th scope="row" className="text-left font-normal">{work}</th>
                  <td>{hours}</td>
                  <td className="whitespace-nowrap">{rate}</td>
                  <td className="whitespace-nowrap">{amount}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-[#e2d8d5] bg-[#f8f0eb] font-semibold">
              <tr className="text-right">
                <th scope="row" className="text-left">Subtotaal excl. btw</th>
                <td>11</td>
                <td />
                <td className="whitespace-nowrap">€ 685,00</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="leading-7">Heb je ook materialen geleverd? Zet die op een aparte regel met een omschrijving, hoeveelheid en prijs per eenheid.</p>
      </section>

      <section id="how-it-works" className="space-y-4 rounded-md border border-[#e2d8d5] bg-[#fbf8f5] p-5 sm:p-7">
        <h2 className="text-2xl font-semibold">Maak je urenfactuur met Time2Pay</h2>
        <p className="leading-7">
          Kies je klant, voeg de urenregels toe en vul per regel het afgesproken tarief in. Je kunt uren en materialen
          op dezelfde factuur zetten. Staat een verzonden factuur nog open? Dan kun je vanuit die factuur zelf een
          betalingsherinnering per e-mail sturen, met de oorspronkelijke factuur als PDF.
        </p>
        <div className="flex flex-wrap items-center gap-4 font-semibold text-[#543749]">
          <div className="underline underline-offset-4"><DemoVideoTrigger /></div>
          <Link href="/register" className="rounded-md bg-[#543749] px-4 py-3 text-white hover:bg-[#3e2937]">
            Gratis account aanmaken
          </Link>
        </div>
        <p className="text-sm text-[#62545d]">Je werk gedaan. Je factuur geregeld.</p>
      </section>
    </article>
  );
}
