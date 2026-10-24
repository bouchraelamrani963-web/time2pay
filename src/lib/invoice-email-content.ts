import { shiftLabel } from "./shift-rates";

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "Europe/Amsterdam",
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

export function buildInvoiceHtml(params: {
  clientName: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  total: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  senderName: string;
  notes: string | null;
  items: {
    type: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    serviceType?: string | null;
    ortPerc?: number;
    ortBedrag?: number;
    unit: string | null;
  }[];
}) {
  const ortAmount = params.items.reduce((sum, item) => sum + (item.ortBedrag ?? 0), 0);
  const itemRows = params.items
    .map((item) => {
      const unitLabel = item.unit || itemTypeLabels[item.type] || item.type;
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.description)}${(item.ortBedrag ?? 0) > 0 ? `<div style="font-size: 12px; color: #9a624d;">Basis ${escapeHtml(currencyFormatter.format(item.lineTotal))} + ORT ${escapeHtml(item.ortPerc ?? 0)}%: +${escapeHtml(currencyFormatter.format(item.ortBedrag ?? 0))}</div>` : ""}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(shiftLabel(item.serviceType) || itemTypeLabels[item.type] || item.type)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${escapeHtml(formatNumber(item.quantity))} ${escapeHtml(unitLabel)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${escapeHtml(currencyFormatter.format(item.unitPrice))}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${escapeHtml(currencyFormatter.format(item.lineTotal + (item.ortBedrag ?? 0)))}</td>
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

            <div style="margin-top: 24px; text-align: right; line-height: 1.8;">
              ${ortAmount > 0 ? `<div>Basisbedrag: ${escapeHtml(currencyFormatter.format(params.subtotal - ortAmount))}</div><div>ORT: ${escapeHtml(currencyFormatter.format(ortAmount))}</div>` : ""}
              <div>Subtotaal: ${escapeHtml(currencyFormatter.format(params.subtotal))}</div>
              <div>BTW (${escapeHtml(params.vatRate)}%): ${escapeHtml(currencyFormatter.format(params.vatAmount))}</div>
            </div>
            <div style="margin-top: 12px; text-align: right; font-size: 20px; font-weight: 700;">
              Totaalbedrag: ${escapeHtml(currencyFormatter.format(params.total))}
            </div>
            ${params.notes?.trim()
              ? `
              <div style="margin-top: 24px; padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px;">
                <div style="margin-bottom: 8px; font-size: 13px; font-weight: 700; color: #374151;">Notities / betaalinformatie</div>
                <div style="white-space: pre-line; color: #374151; font-size: 14px; line-height: 1.6;">${escapeHtml(params.notes)}</div>
              </div>`
              : ""}
          </div>
        </div>
      </div>
    </div>`;
}

export function buildInvoiceText(params: Parameters<typeof buildInvoiceHtml>[0]) {
  const ortAmount = params.items.reduce((sum, item) => sum + (item.ortBedrag ?? 0), 0);
  const notes = params.notes?.trim();
  return [
    `Beste ${params.clientName},`,
    "",
    "Hierbij ontvang je de factuur. Graag betalen vóór de vervaldatum.",
    "",
    `Factuurnummer: ${params.invoiceNumber}`,
    `Factuurdatum: ${dateFormatter.format(params.issueDate)}`,
    `Vervaldatum: ${dateFormatter.format(params.dueDate)}`,
    ...params.items.map(item => `${shiftLabel(item.serviceType) || itemTypeLabels[item.type] || item.type} — ${item.description}: ${item.type === "FIXED" ? "vast bedrag" : `${formatNumber(item.quantity)} ${item.unit || ""} x`} ${currencyFormatter.format(item.unitPrice)}${(item.ortBedrag ?? 0) > 0 ? ` + ORT ${item.ortPerc}% ${currencyFormatter.format(item.ortBedrag ?? 0)}` : ""} = ${currencyFormatter.format(item.lineTotal + (item.ortBedrag ?? 0))}`),
    ...(ortAmount > 0 ? [`Basisbedrag: ${currencyFormatter.format(params.subtotal - ortAmount)}`, `ORT: ${currencyFormatter.format(ortAmount)}`] : []),
    `Subtotaal: ${currencyFormatter.format(params.subtotal)}`,
    `BTW (${params.vatRate}%): ${currencyFormatter.format(params.vatAmount)}`,
    `Totaalbedrag: ${currencyFormatter.format(params.total)}`,
    ...(notes ? ["", "Notities / betaalinformatie", notes] : []),
    "",
    "Met vriendelijke groet,",
    "Time2Pay",
  ].join("\n");
}

