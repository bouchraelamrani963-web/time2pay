import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { mollieApi, mollieMode, MolliePaymentError } from "./mollie-connect";

type PaymentLink = {
  id: string; mode: "test" | "live";
  amount: { currency: string; value: string };
  _links: { paymentLink: { href: string } };
};
export function euroCents(value: number): number {
  if (!Number.isFinite(value) || value <= 0) throw new MolliePaymentError("Factuurbedrag is niet geschikt voor online betaling.");
  const cents = Math.round(value * 100);
  if (Math.abs(cents / 100 - value) > 0.001) throw new MolliePaymentError("Factuurbedrag bevat te veel decimalen.");
  return cents;
}
function publicOrigin() {
  const url = process.env.MOLLIE_PUBLIC_URL;
  if (!url || !url.startsWith("https://")) throw new MolliePaymentError("Publieke Mollie-terugkoppeling ontbreekt.");
  const parsed = new URL(url);
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) throw new MolliePaymentError("Ongeldige Mollie-basis-URL.");
  return parsed.origin;
}
export async function paymentUrlForInvoice(invoice: {
  id: string; userId: string; number: string; total: number; status: string;
}): Promise<string> {
  const mode = mollieMode();
  if (!mode) throw new MolliePaymentError("Online betalen is nog niet geactiveerd.");
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
    throw new MolliePaymentError("Een betaalde of geannuleerde factuur kan niet worden verstuurd.");
  }
  const amountCents = euroCents(invoice.total);
  const connection = await prisma.mollieConnection.findUnique({ where: { userId: invoice.userId } });
  if (!connection?.profileId) throw new MolliePaymentError("Koppel je eigen Mollie-account en kies een betaalprofiel bij Instellingen.");
  const previous = await prisma.invoicePaymentLink.findUnique({ where: { invoiceId: invoice.id } });
  if (previous) {
    if (previous.userId !== invoice.userId || previous.amountCents !== amountCents ||
      previous.profileId !== connection.profileId || previous.mode !== mode) {
      throw new MolliePaymentError("Deze factuur heeft een betaallink met andere gegevens. Controleer de koppeling.");
    }
    if (!previous.url) throw new MolliePaymentError("De betaallink wordt nog aangemaakt. Probeer het opnieuw.");
    return previous.url;
  }
  // Reservation prevents duplicate issuance across serverless instances.
  const webhookKey = randomBytes(32).toString("hex");
  try {
    await prisma.invoicePaymentLink.create({
      data: { invoiceId: invoice.id, userId: invoice.userId,
        webhookKey, amountCents, profileId: connection.profileId, mode },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new MolliePaymentError("Een betaallink wordt al voorbereid. Probeer het opnieuw.");
    }
    throw error;
  }
  try {
    const link = await mollieApi<PaymentLink>(invoice.userId, "/v2/payment-links", "POST", {
      profileId: connection.profileId, testmode: mode === "test", reusable: false,
      amount: { currency: "EUR", value: (amountCents / 100).toFixed(2) },
      description: ("Factuur " + invoice.number).slice(0, 255),
      webhookUrl: publicOrigin() + "/api/mollie/webhook/" + webhookKey,
      // The hosted Mollie checkout confirms method availability, including Wero where enabled.
      redirectUrl: publicOrigin() + "/betaling-afgerond",
    });
    const linkUrl = link._links?.paymentLink?.href;
    if (!link.id?.startsWith("pl_") || link.mode !== mode ||
      link.amount?.currency !== "EUR" || Number(link.amount.value) !== amountCents / 100 ||
      !linkUrl?.startsWith("https://payment-links.mollie.com/")) {
      throw new MolliePaymentError("Mollie gaf een onverwachte betaallink terug.");
    }
    await prisma.invoicePaymentLink.update({
      where: { invoiceId: invoice.id },
      data: { paymentLinkId: link.id, url: linkUrl },
    });
    return linkUrl;
  } catch (error) {
    // Only the unissued reservation may be retried.
    await prisma.invoicePaymentLink.deleteMany({
      where: { invoiceId: invoice.id, webhookKey, url: null },
    }).catch(() => undefined);
    throw error;
  }
}
