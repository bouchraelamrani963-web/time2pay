import { trialPresentation } from "@/lib/registration-trial-policy";
import type { Metadata } from "next";
import LandingPage from "@/components/LandingPage";
import { registrationTrialEnabled, launchOfferAvailable } from "@/lib/registration-trial";

const siteUrl = "https://www.time2pay.nl/";
const title = "Factuurprogramma voor zzp’ers | Time2Pay";
const description =
  "Factureer uren, materialen en vierkante meters met Time2Pay. Gebruik verschillende tarieven en houd overzicht over je klanten en betalingen.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: siteUrl },
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: "Time2Pay",
    url: siteUrl,
    title,
    description,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}#website`,
      name: "Time2Pay",
      url: siteUrl,
      inLanguage: "nl-NL",
      publisher: { "@id": `${siteUrl}#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}#organization`,
      name: "Time2Pay",
      url: siteUrl,
      logo: `${siteUrl}brand/time2pay-logo.svg`,
      description: "Nederlandstalige facturatiesoftware voor zelfstandigen.",
    },
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}#app`,
      name: "Time2Pay",
      url: siteUrl,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Webbrowser",
      inLanguage: "nl-NL",
      description,
      areaServed: { "@type": "Country", name: "Nederland" },
      provider: { "@id": `${siteUrl}#organization` },
    },
  ],
};

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <LandingPage trialEnabled={registrationTrialEnabled()} launchOffer={launchOfferAvailable()} trialCopy={trialPresentation(registrationTrialEnabled(), process.env.TIME2PAY_LAUNCHED_AT)} />
    </>
  );
}
