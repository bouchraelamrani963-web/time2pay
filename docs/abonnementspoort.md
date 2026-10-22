# Time2Pay — abonnementspoort voor facturen

Status: vastgesteld functioneel ontwerp (22 oktober 2026). **Nog niet technisch actief.**
Deze functionaliteit mag niet automatisch naar productie totdat Stripe Checkout, webhooks, rechten, limieten en regressietests gereed zijn.

## Gratis toegang
- Account registreren en inloggen zonder betaalgegevens.
- Dashboard en klantbeheer bekijken.
- Factuur opstellen, bewerken en als concept bewaren; onbeperkt concepten mogelijk.
- In de applicatie een leesbaar voorbeeld bekijken, uitsluitend als concept met zichtbaar watermerk **CONCEPT · Niet geldig als definitieve factuur**.
- Duidelijk vooraf tonen: verzenden, definitieve PDF downloaden en afdrukken vereisen een actief abonnement.

## Betaalde handelingen (zelfde check)
- Factuur per e-mail verzenden of opnieuw verzenden.
- Een definitieve PDF genereren/downloaden, ook bij bestaande facturen.
- Definitieve factuur afdrukken. Betaalde print via beschermde PDF-uitvoer; geen rechtstreekse window.print() op een onbeveiligde, volledige factuur.
- Betalingsherinneringen sturen als die de factuur als bijlage hebben.
- Wijzigen van concept naar SENT / PAID / OVERDUE via PATCH of andere API mag niet dienen als omweg voor de betaalpoort; workflow expliciet afdwingen.
- Server-side invoer- en autorisatiechecks; frontend-vergrendeling is alleen UX.

## Abonnementen
- Starter: €9/maand, maximaal **30 voor het eerst uitgegeven** facturen per abonnementsperiode.
- Pro: €19/maand, onbeperkt facturen.
- Business: €39/maand, onbeperkt facturen.
- Concepten tellen niet als uitgegeven. Herhaald downloaden, afdrukken, herinneren of opnieuw versturen van *dezelfde* uitgegeven factuur telt niet opnieuw.
- Teller baseren op de **echte Stripe-abonnementsperiode**, niet blind op kalendermaand; bij planwissel per tijdvak duidelijke businessregel.
- Geen betaalgegevens nodig voor aanmaken van account en concepten.

## Technische eisen vóór activering
1. Plan- en statusmodel op server met actieve/afgelopen/geannuleerde/achterstallige Stripe-abonnementen, betaalperiode en gebruiksteller (apart van invoice.status).
2. Stripe Checkout voor planselectie; betaalstatus uitsluitend via **ondertekende webhooks** bevestigen en idempotent opslaan. Alleen succesvolle, toegestane abonnementsstatussen geven toegang.
3. Gedeelde server-authorisatie voor versturen, herinneren, PDF-uitgifte, print en statuswijzigingen. Alle routes vereisen geauthenticeerde eigenaar.
4. Starter-limiet **transactie-veilig** en idempotent boeken bij eerste uitgifte; voorkom twee gelijktijdige uitgiften boven het limiet. Behoud historisch uitgiftegegeven ook bij archiveren/verwijderen.
5. Preview en live gegevens gescheiden; testen uitsluitend met Stripe testmodus en testdatabase. Geen live Stripe-credentials in Git.
6. Factuur als **CONCEPT** duidelijk markeren, incl. browserweergave en print stylesheet. Een gebruiker kan screenshots of browserafdrukken nooit volledig worden ontzegd; een watermerk en geen geldige definitieve factuurlayout in gratis preview beperken misbruik, maar vormen geen DRM.
7. Success/failure flows: mislukt/afgebroken betalen laat concept intact; na succesvol betalen keer terug naar concept en vraag expliciete bevestiging van verzenden (geen automatische klantmail zonder nieuwe actie).
8. Als Stripe-voorziening niet is geactiveerd, mag systeem **geen onbruikbare betaalpoort in productie tonen**. Oude gebruikers blijven functioneren totdat de complete betaalflow expliciet wordt uitgerold.

## Vóór release controleren
- Gratis gebruiker: concept ja; verzending, definitieve PDF, print en API-omweg nee.
- Betalende Starter: 30 unieke uitgegeven facturen in periode ja, 31e nee, opnieuw verzenden wel.
- Pro en Business: onbeperkt volgens productregels.
- Verlopen/geannuleerd abonnement: geen nieuwe uitgifte. Toegang tot al uitgegeven administratie en exportbeleid expliciet vastleggen.
- Admin rol / testaccounts kunnen alleen via expliciete serverbevoegdheid een uitzondering krijgen; niet op basis van browserinstellingen.

**Let op:** abonnementsprijzen en pakketfuncties op de huidige publieke site zijn niet per se technisch afgedwongen. Publiceer geen belofte van een al werkende betaalpoort tot implementatie getest is.
