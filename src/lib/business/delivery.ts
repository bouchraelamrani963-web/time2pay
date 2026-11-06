import "server-only";
import { z } from "zod";
import { buildInvoicePdf, getInvoicePdfFilename, type PdfInvoice } from "../invoice-pdf";
import { buildInvoiceHtml, buildInvoiceText } from "../invoice-email-content";
import { getInvoiceEmailConfig } from "../email";
import { BusinessError } from "./access";
import { settingsSchema } from "./contracts";

const clientSnapshot = z.object({
  name: z.string(), email: z.string().nullable(), address: z.string().nullable(), vatNumber: z.string().nullable(),
});

export function invoiceDocument(invoice: Omit<PdfInvoice, "client"> & { issuerSnapshot: unknown; clientSnapshot: unknown }) {
  const issuer = settingsSchema.safeParse(invoice.issuerSnapshot);
  const client = clientSnapshot.safeParse(invoice.clientSnapshot);
  if (!issuer.success || !client.success) throw new BusinessError(409, "De definitieve factuurgegevens ontbreken.");
  const settings = { ...issuer.data, phone: issuer.data.phone || null };
  const data = { ...invoice, client: client.data };
  const pdf = buildInvoicePdf(data, settings.companyName, settings);
  return { data, pdf, filename: getInvoicePdfFilename(invoice.number), sender: settings.companyName };
}

export async function deliverBusinessInvoice(
  document: ReturnType<typeof invoiceDocument>, reminder: boolean, deliveryKey: string,
) {
  const { data, pdf, filename, sender } = document;
  if (!data.client.email) throw new BusinessError(422, "Er staat geen e-mailadres op deze definitieve factuur.");
  try {
    const { resend, from, testRecipient } = getInvoiceEmailConfig();
    const invoice = { ...data, clientName: data.client.name, invoiceNumber: data.number, senderName: sender };
    const message = reminder
      ? { text: `Beste ${data.client.name},\n\nVolgens onze administratie staat factuur ${data.number} nog open. Je vindt de factuur in de bijlage.\n\nMet vriendelijke groet,\n${sender}` }
      : { html: buildInvoiceHtml(invoice), text: buildInvoiceText(invoice) };
    const { error } = await resend.emails.send({
      from, to: testRecipient || data.client.email,
      subject: `${testRecipient ? "[TEST] " : ""}${reminder ? "Betalingsherinnering" : "Factuur"} ${data.number}`,
      ...message, attachments: [{ content: pdf, filename, contentType: "application/pdf" }],
    }, { idempotencyKey: deliveryKey });
    if (error) throw new Error("Provider refused the delivery");
  } catch {
    throw new BusinessError(502, "De e-mail kon niet worden verstuurd. Probeer het later opnieuw.");
  }
}

export async function notifyInvite({ email, name }: { email: string; name: string }) {
  try {
    const { resend, from, testRecipient } = getInvoiceEmailConfig();
    const link = "https://www.time2pay.nl/business";
    const { error } = await resend.emails.send({
      from, to: testRecipient || email,
      subject: "Uitnodiging voor Time2Pay Business",
      text: `Je bent uitgenodigd voor de Business-omgeving van ${name}. Open ${link} en meld je aan met je eigen Time2Pay-account en authenticator. Gebruik het e-mailadres waarop je deze uitnodiging hebt ontvangen. De uitnodiging verloopt na zeven dagen.`,
    });
    return !error;
  } catch {
    return false;
  }
}
