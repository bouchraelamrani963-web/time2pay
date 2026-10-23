# Time2Pay authenticator-login — 23 oktober 2026

Status: code voorbereid in de conceptbranch. Niet live geactiveerd.

## Gedrag

- Native Firebase TOTP: wachtwoord, daarna zes cijfers uit de authenticator.
- De server verifieert de Firebase-handtekening, intrekking, accountstatus,
  recent aanmelden en de ondertekende `firebase.sign_in_second_factor=totp`.
- Zodra een account TOTP heeft, zijn wachtwoordtokens en eerder uitgegeven
  cookies zonder tweede factor onvoldoende, ook zonder verplichte uitrol.
- `TIME2PAY_REQUIRE_TOTP=true` verplicht TOTP voor iedereen in die deployment.
  Nieuwe accounts gaan eerst via e-mailbevestiging en koppeling. De nieuwe
  factor geeft geen directe app-sessie: daarna opnieuw inloggen met de code.
- Instellen vereist `TIME2PAY_TOTP_SETUP_ENABLED=true`. Preview vereist ook
  `TIME2PAY_TOTP_TEST_PROJECT_ID`, gelijk aan beide Firebase-project-ID's en
  ongelijk aan het bekende liveproject `time2pay-c5c5c`. Standaard uit.
- De instelsleutel blijft uitsluitend in tijdelijke componentstatus en wordt
  direct aan Firebase gebruikt. Geen externe QR-service, eigen OTP-database,
  logboek, URL, browseropslag of appserver ontvangt de sleutel of code.
- Meerdere gekoppelde authenticatoren: keuze bij inloggen. Verkeerde/verlopen
  code houdt het scherm open. Opnieuw beginnen wist code en tijdelijk geheim.
- Verlies van de authenticator: beheerder moet identiteit controleren vóór
  herstel via Firebase Admin. Er zijn geen fictieve herstelcodes of automatische
  e-mailbypass ingebouwd. Operationeel herstelprotocol vastleggen vóór livegang.

## Testen en uitrol

13 gerichte authenticatietests en de bestaande 19 billing/mailtests geslaagd.
TypeScript en volledige Next.js-build geslaagd. Reële providerketen nog niet
getest; de geïsoleerde Firebase-omgeving moet eerst worden aangesloten.

Firebase TOTP vereist Authentication with Identity Platform en geverifieerde
mailadressen. Geen upgrade, facturatiekoppeling of MFA-inschrijving uitgevoerd
op het liveproject. Geen livegebruikers verplaatst.

Na koppelen aparte testauth: controleer registratie, e-mailbevestiging,
instelsleutel, geldige/onjuiste/verlopen code, opnieuw inloggen, directe
API-aanroepen, oude cookies en veilig herstel. Door nieuwe Firebase-UID's zijn
bestaande testfacturen eigendom van de oude testidentiteit; geen UID's of
facturen automatisch omhangen.

Bronnen (geraadpleegd 23 oktober 2026):
- https://firebase.google.com/docs/auth/web/totp-mfa
- https://firebase.google.com/docs/auth/admin/manage-cookies
- https://firebase.google.com/docs/reference/admin/node/firebase-admin.auth.decodedidtoken

## Firebase-voorbereiding — 23 oktober 2026

Aparte omgeving `time2pay-preview` aangemaakt in het bestaande Google-account.
Spark-plan behouden (console toont geen kosten), Gemini en Analytics niet aangezet.
E-mail/wachtwoordprovider ingeschakeld. Authentication with Identity Platform
geactiveerd uitsluitend op dit nieuwe, lege testproject; Spark blijft behouden.
SMS-MFA blijft uit. TOTP-providerconfiguratie nog niet toegepast.

Er is nog geen technische privésleutel gemaakt of Vercel-authconfiguratie
vervangen. Het bevestigingsvenster voor een sleutel van
firebase-adminsdk-fbsvc@time2pay-preview.iam.gserviceaccount.com staat klaar.
Dit is een sleutel voor de Firebase-services van alleen het aparte testproject;
geen productietoegang. Aanmaak en veilige overdracht naar de Vercel-testbranch
wachten op expliciete bevestiging. Het testproject heeft nog geen gebruikers.

De loginpagina van commit 6ee9e1f is bereikbaar in Preview. Een nieuwe aanmelding
met echte tweede factor is nog niet bewezen. Alle activatieflags blijven uit.
`scripts/enable-test-totp.cjs` bevat een native Admin SDK-configuratiestap voor
uitsluitend het apart opgegeven testproject, zonder credentialuitvoer; niet
uitgevoerd. De script blokkeert het bekende liveproject.

## Veilige handmatige sleuteloverdracht — 23 oktober 2026

Na expliciete toestemming is een testsleutel gemaakt. De browser-downloadcontrole
liep vast en de verbinding is hersteld. De sleutel bestaat: Google Cloud toont
key-ID f0041420771ac068cedc47f9ac45a5b356406e55 bij de afzonderlijke
Firebase Admin SDK-serviceaccount. De privésleutel is niet ingezien of gelogd.
Browserbeveiliging blokkeert toegang tot chrome://downloads; geen workaround
gebruikt om het bestand uit te lezen.

Een Vercel-formulier staat klaar met tien Secret-variabelen voor uitsluitend
Preview-branch codex/time2pay-stripe-test. Nog niet opgeslagen. De eigenaar
moet de volledige JSON uit het gedownloade testbestand zelf in de eerste
waarde FIREBASE_TEST_SERVICE_ACCOUNT_JSON plakken en opslaan. Geen geheimen
via chat. De andere negen waarden zijn ingevuld: aparte server/client-project-ID,
web-appconfiguratie en TOTP-flags. Web-app Time2Pay Preview is geregistreerd,
app-ID 1:915356451132:web:a3c30603687a4f5e669e39.

De testserver accepteert uitsluitend een JSON-sleutel voor dit geïsoleerde
project, weigert gedeelde productiecredentials en een bestaande default-app,
en weigert deze testmodus in Vercel Production. Drie aanvullende grenscontroles
slagen: totaal 16 auth-tests plus 19 billing/mailtests. Volledige build geslaagd.

Na veilige opslag en expliciete testredeploy configureert de bewaakte buildstap
TOTP met adjacentIntervals=0, alleen wanneer TIME2PAY_CONFIGURE_TEST_TOTP=true.
Deze stap leest alleen de aparte testcredential, verifieert project en provider,
en logt geen geheimen. Bij ontbrekende rechten/configuratie stopt de build;
geen publieke setup-route. Productie heeft deze flags niet.

Providerinschrijving en daadwerkelijke login met autorisatiecode zijn nog niet
uitgevoerd. Vóór livegang ook veilig identiteitsherstel en verlies van telefoon
testen. De eigenaar voert persoonlijke wachtwoord-/authenticator-inschrijving
zelf uit. Live website en bestaande liveidentiteiten zijn ongewijzigd.
