# Time2Pay — Stripe sandbox, 22 oktober 2026

Deze wijziging is uitsluitend voorbereid voor een aparte testdeployment. Niet
mergen naar productie voordat de volledige testketen is gecontroleerd. Er zijn
geen echte klanten, betalingen of klantabonnementen aangemaakt.

## Dashboardconfiguratie

Sandbox: `acct_1UTMA8ITnweMFGCg` (Time2pay sandbox).

| Product | Maandprijs inclusief btw | Stripe-testprijs |
| --- | --- | --- |
| Starter | EUR 9 | price_1UTMKLITnweMFGCgJdeTu8jS |
| Pro | EUR 19 | price_1UTMKqITnweMFGCg55kyL7v5 |
| Business | EUR 39 | price_1UTMLHITnweMFGCgOCtomBjz |

Alle prijzen zijn terugkerend per maand, EUR, expliciet inclusief belasting,
zonder gratis Stripe-proefperiode. Productcategorie: elektronische diensten.
Nederlandse testregistratie toegevoegd voor een binnenlandse verkoper, zonder
import van fysieke goederen, met het testschema voor kleine grensoverschrijdende
EU-verkopen. De preview toont 21% btw. Dit is geen bevestiging van de echte
btw-registratie, KOR-status of omzet. Deze testregistratie niet blind kopiëren
naar live. Automatische belasting voor dashboardtransacties staat aan.

## Testdeployment en opgeslagen configuratie

Alle wijzigingen gelden alleen voor Vercel Preview, gitbranch
`codex/time2pay-stripe-test`. De productiedeployment is niet gewijzigd.

- Aparte gratis Neon-database `time2pay-stripe-test`, regio Frankfurt,
  resource `red-block-41592881`. Geen productiedata gekopieerd.
- Het volledige Prisma-schema is op de lege testdatabase toegepast via de
  Vercel SQL-editor. Gecontroleerd: `billing_accounts`, `clients`,
  `company_settings`, `invoice_items`, `invoices` bestaan.
- Branchspecifieke geheime waarden opgeslagen: `DATABASE_URL`, `DIRECT_URL`,
  `STRIPE_TEST_RESTRICTED_KEY`, `STRIPE_TEST_WEBHOOK_SECRET` en
  `TIME2PAY_BILLING_MODE=test`. De gedeelde productievariabelen zijn behouden.
- Restricted Stripe-testkey: Account, Prices, Tax settings/registrations,
  Subscriptions en Invoices read; Customers, Checkout Sessions en Customer
  Portal write. Geen sleutels in git of dit document.
- Sandbox-webhook `we_1UTNzpITnweMFGCg0lUasbPD`: alleen
  `checkout.session.completed` en `checkout.session.async_payment_succeeded`,
  API-versie `2026-09-30.endive`, bestemming:
  `https://time2pay-git-codex-tim-c28bac-bouchraelamrani963-4055s-projects.vercel.app/api/billing/webhook`.
  Aflevering nog niet bewezen. De handler verifieert handtekeningen en weigert
  live-events. Ieder beschermd verzoek leest de actuele abonnementsstatus bij
  Stripe; daarvoor zijn geen aanvullende lifecycle-webhooks vereist.
- Test-klantenportaal: factuurhistorie, betaalgegevens bijwerken en opzeggen
  aan het einde van de betaalde periode. Planwissels staan uit.
- Firebase gebruikt nog de bestaande configuratie voor Production en Preview.
  Authenticatie is dus niet geïsoleerd. Maak geen synthetische gebruikers aan
  in dit gedeelde project. Voor de browsercontrole kan de eigenaar zelf met
  een bestaand account aanmelden; alle factuurdata staat in de testdatabase.
- E-mailcredentials zijn alleen aanwezig voor Production. Testmaillevering is
  niet geconfigureerd. Geen echte e-mails versturen vanuit deze test.

Nog nodig: een aangemelde browserflow, sandbox-checkout inclusief btw,
geverifieerde webhookaflevering, betaalrechten na betaling en intrekking bij
mislukte verlenging/opzegging. Extern POST-verzoek zonder Vercel-sessie geeft HTTP 401. Vercel Standard
Protection blokkeert dus de webhook. Een domeinuitzondering voor alleen de
branchpreview is voorbereid maar NIET toegepast: toestemming voor de wijziging
van toegangsbeveiliging is nodig. De nieuwe Preview-deployment
`C4Ba6x1XHBpbZF8v3xyEviutVEEY` is succesvol gebouwd met de testconfiguratie.

De testintegratie weigert live-sleutels, een ander Stripe-account en
`VERCEL_ENV=production`. Zonder testconfiguratie blijft afrekenen gesloten.
Succes op de terugkeerpagina verleent geen toegang; alleen een geverifieerde
webhook koppelt het abonnement en een daadwerkelijk betaalde factuur met een
actief, niet verlopen abonnement geeft toegang tot verzenden en export.

## Functionele controles

- Gratis account: eerste concept aanmaken; tweede concept (ook bij twee
  gelijktijdige verzoeken) geweigerd. Verwijderen herstelt het gratis tegoed niet.
- Registratie vraagt geen Stripe-klant of betaalgegevens. Facturen opstellen
  veroorzaakt geen Checkout-aanroep.
- Zonder betaling: `/send`, `/remind`, `/pdf` en status naar verzonden/betaald
  geven HTTP 402, ook bij rechtstreekse API-aanroepen. UI verwijst naar `/billing`.
- Gratis preview: gewone browserafdruk bevat alleen een abonnementsmelding.
  Zoals bij iedere webpreview kunnen screenshots of handmatige kopieën niet
  technisch worden uitgesloten.
- Betaald: Starter/Pro/Business testafrekenen, belasting en maandinterval
  controleren; webhook koppelt klant; verzenden en PDF/print werken daarna.
- Mislukte of nog lopende betaling, geannuleerde checkout, verlopen periode,
  opzegging en mislukte verlenging geven geen betaalrechten.
- Verkeerde gebruiker, prijs, account, live-event of ongeldige handtekening
  verleent geen toegang. Herhaalde webhook mag geen extra factuur maken.

Deze wijziging implementeert de gevraagde betaalgrens. Overige marketingbeloften
zoals teams, planquota, ondersteuning en rapportages zijn geen nieuwe functies
in deze wijziging en moeten apart worden geverifieerd vóór een commerciële start.

## Uitgevoerde controles

- TypeScript: `npx tsc --noEmit` geslaagd.
- 12 gerichte tests: `npm run test:billing`, geslaagd met Node 24.19.0.
- `npm run build`: Next.js compileert en genereert alle statische pagina's.
- Nog niet uitgevoerd: aangemelde browserflow, echte Stripe-testcheckout/webhook,
  gelijktijdige databaseverzoeken en levering van testmail. Een aanmelding door
  de eigenaar is nodig voor de browserflow; testmail ontbreekt nog.

