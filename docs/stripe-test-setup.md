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

## Nog nodig voor een werkende testdeployment

1. Gebruik een eigen testdatabase en Firebase-testproject. Geen productiedatabase.
2. Pas daar `prisma/schema.prisma` toe met `prisma db push`. De nieuwe tabel
   `billing_accounts` bewaart uitsluitend klantkoppelingen en de gebruikte gratis
   conceptfactuur. Er zijn geen databasewijzigingen uitgevoerd tijdens deze taak.
3. Configureer servervariabelen, nooit `NEXT_PUBLIC_`:
   - `TIME2PAY_BILLING_MODE=test`
   - `STRIPE_TEST_RESTRICTED_KEY=rk_test_...` uit deze sandbox, met minimale
     rechten: Account/Prices/Tax registrations/Subscriptions read; Customers en
     Checkout Sessions en Billing Portal Sessions write. Geen live-sleutel gebruiken.
   - `STRIPE_TEST_WEBHOOK_SECRET=whsec_...`
4. Maak in deze sandbox een webhook voor de testdeployment op
   `/api/billing/webhook`. Minimaal `checkout.session.completed` en
   `checkout.session.async_payment_succeeded`; daarnaast
   `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` en
   `customer.subscription.deleted` voor observatie van verlengingen. De handler
   verifieert handtekeningen en weigert live-events. Elk beschermd verzoek haalt
   de actuele abonnement- en factuurstatus bij Stripe op, zodat vertraagde of
   herhaalde events geen betaalrechten verlenen.
5. Het test-klantenportaal is opgeslagen: factuurhistorie, betaalgegevens
   bijwerken en opzeggen aan het einde van de betaalde periode. Planwissels
   staan uit. Controleer de betaalmethoden en het portaal met een synthetische
   klant vóór ingebruikname. Er is geen actieve klantinschrijving aangemaakt.
6. Test de onderstaande keten met synthetische accounts, testkaarten en testmail.

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
  gelijktijdige databaseverzoeken en levering van testmail. Daarvoor ontbreken
  de geïsoleerde testdatabase, Firebase-testconfiguratie en Stripe-testsleutels.
