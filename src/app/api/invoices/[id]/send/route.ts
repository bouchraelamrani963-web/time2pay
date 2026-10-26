import { buildInvoiceHtml, buildInvoiceText } from "@/lib/invoice-email-content";
import { authorizeInvoiceIssue } from "@/lib/invoice-issuance";
import { NextResponse } from "next/server";
import { paymentRequired } from "@/lib/billing";
import { hasInvoiceAccess } from "@/lib/invoice-access";
import { prisma } from "@/lib/prisma";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { EmailConfigurationError, getInvoiceEmailConfig } from "@/lib/email";
import { buildInvoicePdf, getInvoicePdfFilename } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

const activeInvoiceSends = new Set<string>();

export async function POST(
  _request: Request,
  { params: promisedParams }: { params: Promise<{ id: string }> }
) {
  const params = await promisedParams;
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;
  if (!await hasInvoiceAccess(user.uid)) return paymentRequired();
  const denied = await authorizeInvoiceIssue(user.uid, params.id);
  if (denied) return denied;

  const sendKey = `${user.uid}:${params.id}`;
  if (activeInvoiceSends.has(sendKey)) {
    return NextResponse.json(
      {
        error: "Factuur wordt al verstuurd",
        message: "Wacht tot de huidige verzendactie klaar is.",
      },
      { status: 409 }
    );
  }

  activeInvoiceSends.add(sendKey);

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: params.id, userId: user.uid },
      include: { client: true, items: { orderBy: { sortOrder: "asc" } } },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
    }

    const recipientEmail = invoice.client.email?.trim();
    if (!recipientEmail) {
      return NextResponse.json(
        {
          error: "Klant heeft geen e-mailadres",
          message: "Voeg eerst een e-mailadres toe aan deze klant.",
        },
        { status: 422 }
      );
    }

    const { resend, from, testRecipient } = getInvoiceEmailConfig();
    const actualRecipient = testRecipient || recipientEmail;
    const companySettings = await prisma.companySettings.findUnique({
      where: { userId: user.uid },
    });
    const senderName = companySettings?.companyName || user.name || user.email || "Time2Pay";
    const emailParams = {
      clientName: invoice.client.name,
      invoiceNumber: invoice.number,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      total: invoice.total,
      subtotal: invoice.subtotal,
      vatRate: invoice.vatRate,
      vatAmount: invoice.vatAmount,
      senderName,
      notes: invoice.notes,
      items: invoice.items,
    };

    const pdfContent = buildInvoicePdf(invoice, senderName, companySettings);
    const pdfFilename = getInvoicePdfFilename(invoice.number);

    const { error } = await resend.emails.send({
      from,
      to: actualRecipient,
      subject: `${testRecipient ? "[TEST] " : ""}Factuur ${invoice.number} van Time2Pay`,
      html: buildInvoiceHtml(emailParams),
      text: buildInvoiceText(emailParams),
      attachments: [
        {
          filename: pdfFilename,
          content: pdfContent,
          contentType: "application/pdf",
        },
      ],
    });

    if (error) {
      console.error("Invoice email provider error", {
        name: "ResendError",
        message: error.message,
      });
      return NextResponse.json(
        {
          error: "Factuur versturen mislukt",
          message: "De e-mailprovider kon de factuur niet versturen.",
        },
        { status: 502 }
      );
    }

    const updateResult = await prisma.invoice.updateMany({
      where: { id: invoice.id, userId: user.uid },
      data: { status: "SENT" },
    });

    if (updateResult.count === 0) {
      return NextResponse.json(
        {
          error: "Factuur niet gevonden",
          message: "De factuur kon niet worden bijgewerkt.",
        },
        { status: 404 }
      );
    }

    const updatedInvoice = await prisma.invoice.findFirst({
      where: { id: invoice.id, userId: user.uid },
      select: { id: true, status: true, updatedAt: true },
    });

    if (!updatedInvoice) {
      return NextResponse.json(
        {
          error: "Factuur niet gevonden",
          message: "De factuur kon niet worden geladen na het versturen.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sentTo: actualRecipient,
      invoice: updatedInvoice,
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const message = error instanceof Error ? error.message : "Onbekende fout";
    console.error("Invoice email send failed", { name, message });

    if (error instanceof EmailConfigurationError) {
      return NextResponse.json(
        {
          error: "E-mailconfiguratie ontbreekt",
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Factuur versturen mislukt",
        message: "Probeer het later opnieuw.",
      },
      { status: 500 }
    );
  } finally {
    activeInvoiceSends.delete(sendKey);
  }
}
