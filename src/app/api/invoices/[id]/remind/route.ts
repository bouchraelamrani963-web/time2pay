import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { EmailConfigurationError, getInvoiceEmailConfig } from "@/lib/email";
import { buildInvoicePdf, getInvoicePdfFilename } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

const activeInvoiceReminders = new Set<string>();

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildReminderHtml(params: {
  clientName: string;
  invoiceNumber: string;
  dueDate: Date;
  total: number;
  senderName: string;
}) {
  return `
    <div style="margin: 0; padding: 0; background: #f8fafc; font-family: Arial, sans-serif; color: #111827;">
      <div style="max-width: 680px; margin: 0 auto; padding: 32px 16px;">
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;">
          <div style="padding: 28px 32px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-size: 22px; font-weight: 700; color: #2563eb;">Time2Pay</div>
            <h1 style="margin: 24px 0 8px; font-size: 24px; line-height: 1.3;">Betalingsherinnering factuur ${escapeHtml(params.invoiceNumber)}</h1>
            <p style="margin: 0; color: #4b5563; line-height: 1.6;">
              Beste ${escapeHtml(params.clientName)}, volgens onze administratie staat onderstaande factuur nog open.
              Wil je deze alsnog betalen?
            </p>
          </div>

          <div style="padding: 28px 32px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
              <tbody>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Klant</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(params.clientName)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Factuurnummer</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(params.invoiceNumber)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Vervaldatum</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(dateFormatter.format(params.dueDate))}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Openstaand bedrag</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 20px; font-weight: 700;">${escapeHtml(currencyFormatter.format(params.total))}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Afzender</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(params.senderName)}</td>
                </tr>
              </tbody>
            </table>

            <p style="margin: 0; color: #4b5563; line-height: 1.6;">
              De factuur is voor de zekerheid opnieuw toegevoegd als PDF-bijlage.
            </p>
          </div>
        </div>
      </div>
    </div>`;
}

function buildReminderText(params: {
  clientName: string;
  invoiceNumber: string;
  dueDate: Date;
  total: number;
  senderName: string;
}) {
  return [
    `Beste ${params.clientName},`,
    "",
    "Volgens onze administratie staat onderstaande factuur nog open.",
    "Wil je deze alsnog betalen?",
    "",
    `Factuurnummer: ${params.invoiceNumber}`,
    `Vervaldatum: ${dateFormatter.format(params.dueDate)}`,
    `Openstaand bedrag: ${currencyFormatter.format(params.total)}`,
    `Afzender: ${params.senderName}`,
    "",
    "De factuur is voor de zekerheid opnieuw toegevoegd als PDF-bijlage.",
    "",
    "Met vriendelijke groet,",
    "Time2Pay",
  ].join("\n");
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;

  const sendKey = `${user.uid}:${params.id}`;
  if (activeInvoiceReminders.has(sendKey)) {
    return NextResponse.json(
      {
        error: "Herinnering wordt al verstuurd",
        message: "Wacht tot de huidige herinnering klaar is.",
      },
      { status: 409 }
    );
  }

  activeInvoiceReminders.add(sendKey);

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: params.id, userId: user.uid },
      include: { client: true, items: { orderBy: { sortOrder: "asc" } } },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
    }

    if (invoice.status !== "SENT" && invoice.status !== "OVERDUE") {
      return NextResponse.json(
        {
          error: "Herinnering niet mogelijk",
          message: "Alleen verzonden of te late facturen kunnen een herinnering krijgen.",
        },
        { status: 409 }
      );
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

    const { resend, from } = getInvoiceEmailConfig();
    const companySettings = await prisma.companySettings.findUnique({
      where: { userId: user.uid },
    });
    const senderName = companySettings?.companyName || user.name || user.email || "Time2Pay";
    const reminderParams = {
      clientName: invoice.client.name,
      invoiceNumber: invoice.number,
      dueDate: invoice.dueDate,
      total: invoice.total,
      senderName,
    };

    const pdfContent = buildInvoicePdf(invoice, senderName, companySettings);
    const pdfFilename = getInvoicePdfFilename(invoice.number);

    const { error } = await resend.emails.send({
      from,
      to: recipientEmail,
      subject: `Betalingsherinnering factuur ${invoice.number}`,
      html: buildReminderHtml(reminderParams),
      text: buildReminderText(reminderParams),
      attachments: [
        {
          filename: pdfFilename,
          content: pdfContent,
          contentType: "application/pdf",
        },
      ],
    });

    if (error) {
      console.error("Invoice reminder provider error", {
        name: "ResendError",
        message: error.message,
      });
      return NextResponse.json(
        {
          error: "Herinnering versturen mislukt",
          message: "De e-mailprovider kon de betalingsherinnering niet versturen.",
        },
        { status: 502 }
      );
    }

    const updateResult = await prisma.invoice.updateMany({
      where: { id: invoice.id, userId: user.uid },
      data: {
        reminderSentAt: new Date(),
        reminderCount: { increment: 1 },
      },
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
      select: { id: true, status: true, reminderSentAt: true, reminderCount: true, updatedAt: true },
    });

    if (!updatedInvoice) {
      return NextResponse.json(
        {
          error: "Factuur niet gevonden",
          message: "De factuur kon niet worden geladen na het versturen van de herinnering.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Betalingsherinnering verstuurd.",
      sentTo: recipientEmail,
      invoice: updatedInvoice,
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const message = error instanceof Error ? error.message : "Onbekende fout";
    console.error("Invoice reminder send failed", { name, message });

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
        error: "Herinnering versturen mislukt",
        message: "Probeer het later opnieuw.",
      },
      { status: 500 }
    );
  } finally {
    activeInvoiceReminders.delete(sendKey);
  }
}
