import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { EmailConfigurationError, getInvoiceEmailConfig } from "@/lib/email";

export const runtime = "nodejs";

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const itemTypeLabels: Record<string, string> = {
  HOURS: "Uren",
  M2: "Per m2",
  MATERIAL: "Materiaal",
  FIXED: "Vast bedrag",
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildInvoiceHtml(params: {
  clientName: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  total: number;
  senderName: string;
  items: {
    type: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    unit: string | null;
  }[];
}) {
  const itemRows = params.items
    .map((item) => {
      const unitLabel = item.unit || itemTypeLabels[item.type] || item.type;
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(itemTypeLabels[item.type] || item.type)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${escapeHtml(formatNumber(item.quantity))} ${escapeHtml(unitLabel)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${escapeHtml(currencyFormatter.format(item.unitPrice))}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${escapeHtml(currencyFormatter.format(item.lineTotal))}</td>
        </tr>`;
    })
    .join("");

  return `
    <div style="margin: 0; padding: 0; background: #f8fafc; font-family: Arial, sans-serif; color: #111827;">
      <div style="max-width: 720px; margin: 0 auto; padding: 32px 16px;">
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;">
          <div style="padding: 28px 32px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-size: 22px; font-weight: 700; color: #2563eb;">Time2Pay</div>
            <h1 style="margin: 24px 0 8px; font-size: 24px; line-height: 1.3;">Factuur ${escapeHtml(params.invoiceNumber)}</h1>
            <p style="margin: 0; color: #4b5563;">Beste ${escapeHtml(params.clientName)}, hierbij ontvang je de factuur. Graag betalen vóór de vervaldatum.</p>
          </div>

          <div style="padding: 28px 32px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
              <tbody>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Klant</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(params.clientName)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Afzender</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(params.senderName)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Factuurdatum</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(dateFormatter.format(params.issueDate))}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Vervaldatum</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(dateFormatter.format(params.dueDate))}</td>
                </tr>
              </tbody>
            </table>

            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
              <thead>
                <tr style="background: #f3f4f6; color: #374151;">
                  <th style="padding: 12px; text-align: left;">Omschrijving</th>
                  <th style="padding: 12px; text-align: left;">Type</th>
                  <th style="padding: 12px; text-align: right;">Aantal</th>
                  <th style="padding: 12px; text-align: right;">Prijs</th>
                  <th style="padding: 12px; text-align: right;">Totaal</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>

            <div style="margin-top: 24px; text-align: right; font-size: 20px; font-weight: 700;">
              Totaalbedrag: ${escapeHtml(currencyFormatter.format(params.total))}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function buildInvoiceText(params: {
  clientName: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  total: number;
}) {
  return [
    `Beste ${params.clientName},`,
    "",
    "Hierbij ontvang je de factuur. Graag betalen vóór de vervaldatum.",
    "",
    `Factuurnummer: ${params.invoiceNumber}`,
    `Factuurdatum: ${dateFormatter.format(params.issueDate)}`,
    `Vervaldatum: ${dateFormatter.format(params.dueDate)}`,
    `Totaalbedrag: ${currencyFormatter.format(params.total)}`,
    "",
    "Met vriendelijke groet,",
    "Time2Pay",
  ].join("\n");
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUserOrUnauthorized();
  if (user instanceof Response) return user;

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

    const { resend, from } = getInvoiceEmailConfig();
    const senderName = user.name || user.email || "Time2Pay";
    const emailParams = {
      clientName: invoice.client.name,
      invoiceNumber: invoice.number,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      total: invoice.total,
      senderName,
      items: invoice.items,
    };

    const { error } = await resend.emails.send({
      from,
      to: recipientEmail,
      subject: `Factuur ${invoice.number} van Time2Pay`,
      html: buildInvoiceHtml(emailParams),
      text: buildInvoiceText(emailParams),
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

    return NextResponse.json({ success: true, sentTo: recipientEmail });
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
  }
}
