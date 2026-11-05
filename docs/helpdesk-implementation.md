# Time2Pay Helpdesk — 5 november 2026

## Plan en afbakening
Basis: `seo/time2pay-facturatie-20261103` (`7246461`). Dit is de huidige voorbereide release met bestaande Firebase/TOTP-sessies, registratie en goedgekeurde homepage. `main` loopt daarop achter. Eén aparte branch en één PR naar deze releasebranch; niet naar productie mergen.

1. Additieve Prisma-tabellen voor tickets, reacties en expliciete supportrollen. Geen wijzigingen aan bestaande auth-, billing- of klantmodellen.
2. Gebruik `requireUser` en `requireUserOrUnauthorized` ongewijzigd. Klantqueries bevatten altijd de Firebase-UID; supportqueries vereisen eerst een actieve rol in `support_agents`.
3. Klantenportaal `/helpdesk`, kennisbank `/helpdesk/knowledge`, aparte beheerpagina `/support`. Dezelfde bestaande huisstijl en componentklassen. Geen chatbot, bijlagen, e-mailintegratie of nieuwe dienst.
4. JSON API met strikte validatie, bodylimiet, same-origin writes, rate limits onder PostgreSQL-transactielocks, vaste veilige foutmeldingen en private/no-store responses. Alleen de server bepaalt eigenaar, ticketnummer en afzenderrol.
5. Gerichte API-/databasecontroles met fictieve tickets en visuele controle van dezelfde React-component op desktop/mobiel. Previewfixtures zijn uitsluitend lokaal en worden niet opgenomen in productieroutes.

## Gedrag
Uniek oplopend TP-nummer; gaten na teruggedraaide transacties zijn normaal. Lijsten: 20 per pagina. Gesprekken: nieuwste 50 met oudere-berichtenpaginering. Klantreacties op wachtende/afgehandelde tickets heropenen deze. Supportreacties zetten niet-afgehandelde tickets op Wacht op klant; afgeronde tickets blijven afgerond tot een expliciete heropening of klantreactie. Beheerder kan alle vier statussen en drie prioriteiten kiezen.

Maximaal 10 nieuwe tickets per uur en 30 berichten per tien minuten per UID. Platte tekst, door React ge-escaped. Geen HTML, uploads of externe verzending. Waarschuwing en servervalidatie blokkeren herkenbare credentialpatronen (o.a. losse zescijfercodes, gelabelde wachtwoorden en herstelcodeformats). Vrije tekst kan niet ieder willekeurig geheim herkennen: support vraagt nooit om geheimen; bij per ongeluk delen moet de eigenaar het geheim intrekken en een operator het bericht laten verwijderen. Er worden geen ticketinhoud of databasefouten gelogd.

## Vrijgave — vereist afzonderlijke toestemming
Geen productieverbinding of productiegegevens nodig tijdens ontwikkeling. Migratiebestand alleen aanleveren; niet automatisch uitvoeren. Vercel-deployments voor deze featurebranch zijn uitgeschakeld. Geen merge/publicatie vanuit deze opdracht.

Na expliciete goedkeuring: back-up en migratiestatus controleren, uitsluitend de additieve migratie toepassen, beheerder-UID onafhankelijk verifiëren en via een vertrouwde operator een `support_agents`-record geven. Er is bewust geen publieke roltoekenningsroute, e-mailallowlist of client-side adminswitch. Standaard heeft niemand supportrechten. Gebruik nooit een UID uit een onbevestigde supportaanvraag om rechten toe te kennen. Uitschakelen: `enabled=false`; iedere volgende serveractie controleert de rol opnieuw.

De kennisbank beschrijft aanwezige schermen, geen vaste tarieven, campagnedatums of abonnementlimieten. Tickets zijn ook zonder actief betaald abonnement bereikbaar.
