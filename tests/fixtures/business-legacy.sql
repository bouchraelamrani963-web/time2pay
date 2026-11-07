-- Fictieve gegevens voor een lokale wegwerpdatabase vóór de Business-migratie.
INSERT INTO clients (id, "userId", name, "updatedAt")
VALUES ('fiction-private-client', 'fiction-owner', 'Privéklant voor migratie', now());
INSERT INTO invoices (id, "userId", number, "clientId", status, "dueDate", subtotal, "vatAmount", total, "updatedAt")
VALUES ('fiction-private-invoice', 'fiction-owner', 'F2026-0789', 'fiction-private-client', 'PAID', now(), 100, 21, 121, now());
INSERT INTO billing_accounts ("userId", "customerId", "subscriptionId", "updatedAt")
VALUES ('fiction-owner', 'cus_fiction', 'sub_fiction', now());
