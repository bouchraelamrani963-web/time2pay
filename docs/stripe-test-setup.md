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
  Aflevering bewezen met sandbox-testevent `evt_1UTOL7ITnweMFGCgGIDMolsn`,
  22 oktober 2026 17:55:38 CEST: HTTP 200, `received: true`. De handler verifieert handtekeningen en weigert
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

De aangemelde Starter-testflow is uitgevoerd. Nog te controleren vóór livegang:
Pro/Business-checkout, mislukte verlenging/opzegging en echte testmaillevering. Na toestemming van de eigenaar is uitsluitend de branchpreview hierboven
uitgezonderd van Vercel Deployment Protection. De Time2Pay-login blijft nodig.
Extern POST-verzoek zonder handtekening geeft nu HTTP 400 (terecht), een door
Stripe ondertekend testbericht geeft HTTP 200. De productiedomeinen blijven
ongewijzigd. Preview `C4Ba6x1XHBpbZF8v3xyEviutVEEY` is succesvol gebouwd met
de testconfiguratie.

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
- Browserflow uitgevoerd op 22 oktober 2026 met bestaand eigenaaraccount en
  volledig synthetische factuurgegevens in de aparte testdatabase:
  eerste concept F2026-5284 aangemaakt; tweede gratis concept geweigerd.
- Zonder betaling leiden Verzenden, PDF downloaden en Afdrukken naar /billing.
- Starter-checkout geslaagd met Stripe-testkaart 4242. Totaal EUR 9 inclusief
  EUR 1,56 btw bij Nederlands testadres. Geen echte betaling.
- Na geverifieerde webhook bevestigt Time2Pay betaalrechten en verdwijnt de
  gratis-conceptmelding. De beschermde PDF opent als één pagina in de browser.
  De automatische download-eventcontrole liep vast; bestandsopslag via de
  downloadknop is daarom niet onafhankelijk bevestigd.
- Portal toont Time2Pay Starter, EUR 9 per maand, betaalde testfactuur van
  22 oktober en volgende factuurdatum 22 november 2026. Sandbox-abonnement
  `sub_1UTOacITnweMFGCgOfOx6FqQ` blijft actief, zonder echte afschrijving.
- Fysiek afdrukken en e-mailbezorging zijn niet uitgevoerd. De testklant heeft
  geen mailadres en Preview heeft geen mailcredentials.
- Nog niet uitgevoerd: Pro/Business-checkout, gelijktijdige databaseverzoeken,
  ingetrokken toegang na mislukte verlenging of einde opzegging.
- Prijskaartknoppen na betaling verduidelijkt naar 'Je hebt al een abonnement',
  zodat ze niet suggereren dat alle drie pakketten zijn afgesloten.
  Deze tekstwijziging volgt via de automatische Preview-build; de functionele
  test hierboven is uitgevoerd vóór deze uitsluitend tekstuele wijziging.


## Aanvullende browsercontroles — 22 en 23 oktober 2026

- Starter per einde periode opgezegd via het klantenportaal. Toegang bleef
  beschikbaar tot de geplande einddatum. Daarna direct beëindigd in de sandbox:
  de gratis-conceptmelding kwam terug en export werd geblokkeerd.
- Pro EUR 19 inclusief EUR 3,30 btw op 22 oktober succesvol afgerekend via de
  Time2Pay-checkout, gekoppeld en vrijgegeven. Subscriptie
  `sub_1UTOoCITnweMFGCgEMIrY6em`, op 23 oktober direct beëindigd voor de
  volgende test.
- Business EUR 39 inclusief EUR 6,77 btw op 23 oktober succesvol afgerekend,
  gekoppeld en vrijgegeven. Subscriptie `sub_1UTdCRITnweMFGCgP7zg5P5p`.
- Fout bij pakketkeuze vlak na opzegging opgelost: de idempotency key bevat
  nu het pakket én de vorige subscription-ID. Hierdoor worden retries
  hergebruikt en nieuwe aankopen niet met een afgeronde checkout verward.
  TypeScript geslaagd; 13 tests geslaagd, inclusief een regressietest voor
  herhalen, pakket wijzigen en opnieuw afsluiten.
- Geweigerde vervolgfactuur gesimuleerd met `pm_card_chargeCustomerFail`.
  Voor een directe test is de Business-subscriptie tijdelijk naar trialing
  gezet en weer beëindigd, daarna is met een tijdelijke aantalwijziging
  (1 naar 2, always_invoice) een positieve factuur afgedwongen. Dit is een
  geforceerde vervolgbetaling, geen volledige kalenderverlenging met testklok.
  Stripe-status werd `past_due`. Zowel de PDF-knop als een rechtstreekse
  GET op de beschermde PDF-route werden geblokkeerd met
  `SUBSCRIPTION_REQUIRED`.
- Aantal teruggezet naar 1; Business vervolgens direct beëindigd. Alle drie
  testabonnementen zijn nu beëindigd; de producten en maandprijzen blijven
  behouden. Testklant en factuurhistorie blijven beschikbaar.
- Nog open: natuurlijke kalenderverlenging, herstel na een mislukte betaling,
  gelijktijdige databaseverzoeken en echte testmailbezorging. Er is nog geen
  aparte Preview-mailkoppeling. Er zijn geen echte betalingen of klantmails
  verstuurd en geen wijzigingen naar productie gemerged.

## Voorbereiding testmail — 23 oktober 2026

- Preview/local weigert productie-mailcredentials en vereist expliciet
  `TIME2PAY_EMAIL_MODE=test` plus een aparte `RESEND_TEST_API_KEY`.
- Alle testfacturen en herinneringen worden server-side omgeleid naar
  `delivered@resend.dev`, met afzender `testmail@time2pay.nl` en
  onderwerpvoorvoegsel [TEST]. De respons rapporteert de daadwerkelijke
  testontvanger; een ingevuld klantadres wordt niet gebruikt voor aflevering.
- Productie behoudt haar eigen mailconfiguratie. Geen productievariabelen
  aangepast. De nieuwe tests en wijzigingen zijn alleen in de conceptbranch.
- Zes aanvullende tests: apart sleutelgebruik, verplichte testmodus, behoud
  productieconfiguratie, testontvanger, HTML-escaping, PDF-bijlage en uitsluitend
  statusmutatie na provideracceptatie voor facturen en herinneringen.
  Totaal 19 tests geslaagd; TypeScript en volledige build geslaagd.
- Echte provideraflevering is nog niet getest. Resend vraagt om aanmelding;
  de inlogpagina staat klaar voor de eigenaar. Er is nog geen nieuwe
  Resend-sleutel gemaakt en geen e-mail verstuurd.
- De bedrijfsvelden in de geïsoleerde testversie zijn leeg. Geen KvK-nummer,
  btw-id, adres of IBAN aangenomen. Echte fiscale registratie/KOR-status moet
  door de eigenaar worden bevestigd vóór livegang.

## Resend-configuratie — 23 oktober 2026

Na expliciete toestemming is een aparte sleutel 'Time2Pay Preview testmail'
aangemaakt: uitsluitend Sending access, beperkt tot time2pay.nl. De sleutel
staat alleen als Secret RESEND_TEST_API_KEY op de Preview-branch
codex/time2pay-stripe-test. TIME2PAY_EMAIL_MODE=test is daar ook opgeslagen.
Productiesleutels blijven ongewijzigd. Testafzender: testmail@time2pay.nl;
ontvanger blijft geforceerd delivered@resend.dev. Providerbezorgtest volgt.

### Validatie mailcredential

De eerste overname van de eenmalige sleutel bleek bij formaatcontrole ongeldig.
Deze waarde is nog niet als werkende providerkoppeling bevestigd. De ongebruikte
Resend-sleutel moet worden ingetrokken en vervangen met identieke rechten;
de onomkeerbare intrekking wacht op expliciete toestemming. Geen mail verzonden.
De synthetische testklant heeft nu delivered@resend.dev als e-mailadres.
De 19 tests slagen met de domeinbeperkte testafzender. Preview-build 1a13490
is Ready. Een verouderde pagina tijdens een deployment gaf kort een serverfout;
na herladen slaagde het opslaan van het testklantadres.

### Vervanging credential — 23 oktober 2026

Ongebruikte eerste sleutel na bevestiging ingetrokken. Vervangende sleutel
heeft dezelfde domeinbeperkte verzendrechten. Formaat vóór opslag gecontroleerd;
Vercel bevestigt succesvolle rotatie van alleen de branchspecifieke
RESEND_TEST_API_KEY. Providerbezorgtest volgt na de nieuwe Preview-build.
