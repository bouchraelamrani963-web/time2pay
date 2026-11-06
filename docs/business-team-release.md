# Time2Pay Business-team

De Business-omgeving is bereikbaar via `/business` zodra `TIME2PAY_BUSINESS_ENABLED=true` is ingesteld. De vlag staat standaard uit. Deze branch heeft geen automatische Vercel-deployment. De homepage kan met de huidige status **Binnenkort beschikbaar** in productie blijven.

## Rechten en gegevens

| Handeling | Eigenaar | Administratie | Medewerker |
| --- | --- | --- | --- |
| Bedrijfsgegevens, IBAN, nummerprefix, factuursjabloon en standaard factuurtekst wijzigen | Ja, met TOTP-aanmelding van maximaal vijf minuten geleden | — | — |
| Business-abonnement beheren | Via eigen bestaande abonnementspagina | — | — |
| Uitnodigen, rol wijzigen en toegang intrekken | Ja | — | — |
| Klanten bekijken | Alle bedrijfsgegevens | Alle bedrijfsgegevens | Naam en factuurtariefgegevens |
| Klanten aanmaken en bewerken | Ja | Ja | — |
| Klant zonder facturen verwijderen | Ja | — | — |
| Concepten aanmaken en bewerken | Alle bedrijfsconcepten | Alle bedrijfsconcepten | Alleen eigen bedrijfsconcepten |
| Concept verwijderen of definitieve factuur administratief annuleren | Ja | — | — |
| Definitief maken, PDF, e-mail, herinnering en betalingsregistratie | Ja | Ja | — |
| Omzetrapportage raadplegen | Ja | Ja | — |

Een bedrijf is eigendom van één Firebase-UID. Een medewerker kan met hetzelfde account zijn persoonlijke administratie en bedrijven waarvoor hij een uitnodiging heeft aanvaard afzonderlijk openen. Bestaande persoonlijke administratie blijft gekoppeld aan de oorspronkelijke UID. De release voert geen automatische import uit, ook bij de eigenaar. Gedeelde gegevens worden in de Business-omgeving aangemaakt.

Een uitnodiging is zeven dagen geldig en reserveert een plaats totdat ze is geaccepteerd, ingetrokken of verlopen. Aanvaarden kan alleen na TOTP met een Firebase-account waarvan het huidige geverifieerde e-mailadres overeenkomt met de uitnodiging. De bestaande e-mailprovider stuurt de notificatie. Als die bezorging mislukt, staat de uitnodiging nog steeds klaar in Time2Pay. Rollen en lidmaatschappen worden opnieuw gecontroleerd nadat de databasevergrendeling is verkregen. Intrekking blokkeert volgende aanvragen met een bestaande sessie.

Definitief maken legt het nummer en de toenmalige afzender- en klantgegevens vast. PDF en e-mail gebruiken deze momentopname. Wijzigingen aan de instelling of klantkaart gelden voor toekomstige facturen. De auditlog bewaart bedrijfs-ID, handelende UID, actie, eventueel doel-ID en tijdstip. Geheimen, uitnodigingse-mailadressen en IBAN-waarden komen niet in deze log.

Business-toegang vereist de bestaande geverifieerde, actuele en betaalde Business-entitlement van de eigenaar. Starter, Pro en de introductieproefperiode geven geen teamrecht. Bij downgrade, einde abonnement of onbeschikbare betaalverificatie stoppen gedeelde mutaties en de toegang van teamleden. De eigenaar houdt inzage, PDF-export en het recht om teamtoegang in te trekken. Herstel van het Business-recht heropent nog actieve lidmaatschappen. Er worden geen transacties gestart in Stripe door deze wijziging.

## Productiemigratie

`20261106150000_business_team` maakt drie tabellen aan, `business_companies`, `business_seats` en `business_audit_events`. De migratie voegt bedrijfsrelaties toe aan klanten en facturen en wijzigt de unieke nummerindex. Persoonlijke nummers blijven globaal uniek. Bedrijfsnummers zijn uniek per bedrijf. Nieuwe constraints bewaken de scheiding tussen persoonlijke en gedeelde rijen, de vier aanvullende plekken en de aanwezigheid van historische momentopnamen. De migratie bevat geen gegevensupdate of backfill.

1. Bevestig afzonderlijke toestemming, de actieve productiebranch, het exacte commit en de juiste Neon-database. Laat Business uitgeschakeld. Controleer met de bestaande directe verbinding de migratiehistorie en beschikbare herstelperiode. Controleer een bruikbare versleutelde back-up en leg het herstelpunt en de huidige Vercel-deployment vast.
2. Bevestig dat alleen deze migratie ontbreekt. Leg aantallen van persoonlijke klanten, facturen, statusverdeling en billingkoppelingen vast zonder persoons- of financiële detailgegevens in logs op te nemen. Plan de migratie in een rustig venster omdat tabel- en indexwijzigingen schrijfbewerkingen tijdelijk kunnen blokkeren.
3. Voer uitsluitend na toestemming `prisma migrate deploy` uit tegen de geverifieerde directe verbinding. Controleer `prisma migrate status`, schema-diff, de nieuwe constraints, persoonlijke aantallen en de bestaande Starter/Pro-routes. Pas het Stripe-betaalpad en live prijsconfiguratie niet aan als onderdeel van deze migratie.
4. Valideer de build met de vlag uit. Na aparte publicatietoestemming kan Business worden vrijgegeven. Een betaalde Business-entitlement in productie vereist de bestaande live betaalconfiguratie en is een afzonderlijke beslissing. Controleer eerst de geautoriseerde Business-toegang en behoud de bestaande homepage-tekst tot daar apart over is besloten.

## Herstel

- Zet de vlag uit en herstel zo nodig de vorige Vercel-deployment. De vorige applicatie ziet bedrijfsrijen niet via persoonlijke Firebase-UIDs. Laat de uitgebreide databasestructuur en eventuele bedrijfsgegevens staan.
- De SQL draait in één transactie. Bij een mislukking controleert de uitvoerder de oorzaak, migratiestatus en het oorspronkelijke schema. Markeer een mislukte migratie pas als teruggedraaid in Prisma nadat de rollback is bevestigd.
- Als Business al gegevens heeft geschreven, draai de schemawijziging niet destructief terug. Verwijder de nieuwe tabellen en kolommen niet. Bij een database-incident moet een afzonderlijk goedgekeurde herstelprocedure rekening houden met persoonlijke en gedeelde wijzigingen sinds het back-upmoment.

## Gerichte verificatie

`tests/business-db.test.cjs` gebruikt echte Prisma-query's en een lokale PostgreSQL-database. De Firebase-claims, Stripe-entitlements en e-mailprovider zijn fictieve fixtures. Gebruik uitsluitend een lokale wegwerpdatabase met de naam `time2pay_business_test`. Zet `DATABASE_URL` en `DIRECT_URL` op die database. Pas de migraties tot en met `20261105170000_helpdesk` toe vanuit de basisbranch. Voer vanuit de Business-branch uit:

```sh
npx prisma db execute --schema prisma/schema.prisma --file tests/fixtures/business-legacy.sql
npx prisma migrate deploy
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
npx prisma generate
TIME2PAY_BUSINESS_DB_TEST=true node --test tests/business-db.test.cjs
```

De test weigert een niet-lokale database.
