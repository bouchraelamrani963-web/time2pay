# Service rates and optional ORT — PR #6

Owner requirement (24 October 2026): default to fixed hourly rates for day, evening, weekend, night and holiday shifts. Entrepreneurs set their own amounts per client; ORT is an explicitly agreed optional feature.

## Behavior

Client create, quick-create, edit and detail views support the five rates (excluding invoice VAT). Blank rates are unset; explicit zero is free work. An unset rate requires a deliberate price entry before a draft can be saved. Choosing a client or shift copies its saved rate into the invoice; changing the client resets ORT and reselects that client's rates. Editing a price on the invoice never edits the client profile.

ORT is hidden by default. It requires a saved client agreement and a separate per-invoice opt-in, both checked by the server. In ORT mode the UI copies the day-shift rate as the base for all hourly services; users select 0/25/50/100% per hourly row. This avoids automatically stacking a higher shift rate with ORT. No service classification or ORT is accepted on materials, area or fixed-price items.

Invoice items store their chosen service, unit price, ORT percentage and computed amounts as a snapshot. Client profile changes do not recalculate existing invoice prices. Existing invoices retain their existing values and unclassified old hours remain unclassified. Historical ORT does not enable future client agreements.

Amounts are calculated on the server, using integer arithmetic for fractional quantities and cent rounding per line and surcharge. The subtotal includes ORT once; VAT applies to that subtotal. HTML invoice, final PDF and HTML/plain-text invoice emails show service, quantity, unit price, inclusive line total, ORT breakdown and totals consistently. Reminder PDFs use the same renderer. VAT-only draft edits recalculate totals; item edits retain the draft's existing VAT unless a new VAT is supplied. Pricing changes to issued invoices are rejected. Document dates use Europe/Amsterdam.

## Migration and test boundaries

Two additive migrations are required: 20261024103000_invoice_item_ort and 20261024120000_client_service_rates. The equivalent additive SQL was applied only to the explicitly named Neon `time2pay-stripe-test` database through its Vercel integration on 24 October 2026. No rows were changed by the historical ORT backfill (none present). Read-only Query mode was restored. Production is untouched. Record/baseline these SQL changes appropriately before using Prisma migrate on the existing test database.

Local validation: 9 focused service/rate/API/output checks, 19 billing/mail checks and 16 authentication checks pass. The Next production build passes. The invoice PDF has been rendered and inspected. Local API tests mock persistence/provider boundaries, so these checks do not replace deployed authenticated browser tests, save/reload, provider delivery and real test-database integration.

Before live publication: complete authenticated Preview acceptance, customer-rate save/reload, default and ORT invoices, another-customer isolation, PDF/download/print/mail and migration rehearsal; integrate the free-drafts/Starter-quota release work (#4) and branding work (#5) without dropping either change. Production Stripe, data backup/restore, existing-user checks and other release blockers remain mandatory. PR #6 targets the sandbox branch, not main. Do not publish or enable real payments based on this change alone.
