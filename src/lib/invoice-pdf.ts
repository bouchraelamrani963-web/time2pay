export type PdfInvoiceItem = {
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unit: string | null;
};

export type PdfInvoiceClient = {
  name: string;
  email: string | null;
  address: string | null;
  vatNumber: string | null;
};

export type PdfInvoice = {
  number: string;
  issueDate: Date;
  dueDate: Date;
  notes: string | null;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  client: PdfInvoiceClient;
  items: PdfInvoiceItem[];
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const LINE_HEIGHT = 15;
const CONTENT_BOTTOM = 60;

const itemTypeLabels: Record<string, string> = {
  HOURS: "Uren",
  M2: "Per m2",
  MATERIAL: "Materiaal",
  FIXED: "Vast bedrag",
};

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  align?: "left" | "right";
  gapBefore?: number;
};

function formatEuro(value: number) {
  return currencyFormatter.format(value).replace("€", "EUR");
}

function formatQuantity(item: PdfInvoiceItem) {
  if (item.type === "FIXED") return "-";
  const quantity = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(item.quantity);
  return `${quantity} ${item.unit ?? ""}`.trim();
}

function safePdfText(value: string) {
  return value
    .replace(/€/g, "EUR")
    .replace(/–|—/g, "-")
    .replace(/•/g, "-")
    .replace(/[\u0100-\uFFFF]/g, "?");
}

function escapePdfText(value: string) {
  return safePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(value: string, maxChars: number) {
  const paragraphs = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

function textWidth(text: string, size: number) {
  return safePdfText(text).length * size * 0.52;
}

function addWrapped(lines: PdfLine[], text: string | null | undefined, maxChars: number, base: Omit<PdfLine, "text"> = {}) {
  const trimmed = text?.trim();
  if (!trimmed) return;
  for (const line of wrapText(trimmed, maxChars)) {
    lines.push({ text: line, ...base });
  }
}

function buildInvoiceLines(invoice: PdfInvoice, senderName: string): PdfLine[] {
  const lines: PdfLine[] = [
    { text: "Time2Pay", size: 22, bold: true },
    { text: `Factuur ${invoice.number}`, size: 18, bold: true, align: "right" },
    { text: `Afzender: ${senderName}`, gapBefore: 8 },
    { text: `Factuurdatum: ${dateFormatter.format(invoice.issueDate)}`, align: "right" },
    { text: `Vervaldatum: ${dateFormatter.format(invoice.dueDate)}`, align: "right" },
    { text: "Klant", size: 12, bold: true, gapBefore: 18 },
    { text: invoice.client.name, bold: true },
  ];

  addWrapped(lines, invoice.client.address, 72);
  if (invoice.client.email) lines.push({ text: invoice.client.email });
  if (invoice.client.vatNumber) lines.push({ text: `BTW: ${invoice.client.vatNumber}` });

  lines.push({ text: "Factuurregels", size: 12, bold: true, gapBefore: 18 });
  lines.push({ text: "Omschrijving | Type | Aantal | Prijs | Totaal", bold: true });

  for (const item of invoice.items) {
    const typeLabel = itemTypeLabels[item.type] || item.type;
    const itemLines = wrapText(item.description, 32);
    const firstLine = `${itemLines[0] ?? ""} | ${typeLabel} | ${formatQuantity(item)} | ${formatEuro(item.unitPrice)} | ${formatEuro(item.lineTotal)}`;
    lines.push({ text: firstLine });
    for (const extraLine of itemLines.slice(1)) {
      lines.push({ text: `  ${extraLine}` });
    }
  }

  lines.push({ text: `Subtotaal: ${formatEuro(invoice.subtotal)}`, align: "right", gapBefore: 18 });
  lines.push({ text: `BTW (${invoice.vatRate}%): ${formatEuro(invoice.vatAmount)}`, align: "right" });
  lines.push({ text: `Totaal te betalen: ${formatEuro(invoice.total)}`, size: 13, bold: true, align: "right" });

  if (invoice.notes?.trim()) {
    lines.push({ text: "Notities / betaalinformatie", size: 12, bold: true, gapBefore: 18 });
    addWrapped(lines, invoice.notes, 82);
  }

  return lines;
}

function paginateLines(lines: PdfLine[]) {
  const pages: PdfLine[][] = [[]];
  let y = PAGE_HEIGHT - MARGIN;

  for (const line of lines) {
    y -= line.gapBefore ?? 0;
    if (y < CONTENT_BOTTOM) {
      pages.push([]);
      y = PAGE_HEIGHT - MARGIN;
    }
    pages[pages.length - 1].push(line);
    y -= LINE_HEIGHT;
  }

  return pages;
}

function renderContent(lines: PdfLine[]) {
  let y = PAGE_HEIGHT - MARGIN;
  const chunks: string[] = [];

  for (const line of lines) {
    y -= line.gapBefore ?? 0;
    const size = line.size ?? 10;
    const x = line.align === "right" ? PAGE_WIDTH - MARGIN - textWidth(line.text, size) : MARGIN;
    const font = line.bold ? "F2" : "F1";
    chunks.push(`BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(line.text)}) Tj ET`);
    y -= LINE_HEIGHT;
  }

  return chunks.join("\n");
}

function createPdf(objects: string[]) {
  const parts = ["%PDF-1.4\n"];
  const offsets: number[] = [];
  let position = Buffer.byteLength(parts[0], "latin1");

  objects.forEach((object, index) => {
    offsets.push(position);
    const part = `${index + 1} 0 obj\n${object}\nendobj\n`;
    parts.push(part);
    position += Buffer.byteLength(part, "latin1");
  });

  const xrefOffset = position;
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  offsets.forEach((offset) => xref.push(`${offset.toString().padStart(10, "0")} 00000 n `));

  parts.push(
    `${xref.join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  return Buffer.from(parts.join(""), "latin1");
}

export function getInvoicePdfFilename(invoiceNumber: string) {
  const safeNumber = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `Factuur-${safeNumber}.pdf`;
}

export function buildInvoicePdf(invoice: PdfInvoice, senderName: string) {
  const pages = paginateLines(buildInvoiceLines(invoice, senderName));
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];

  const pageRefs: string[] = [];

  pages.forEach((pageLines) => {
    const pageObjectNumber = objects.length + 1;
    const contentObjectNumber = objects.length + 2;
    pageRefs.push(`${pageObjectNumber} 0 R`);

    const content = renderContent(pageLines);
    const contentLength = Buffer.byteLength(content, "latin1");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
    objects.push(`<< /Length ${contentLength} >>\nstream\n${content}\nendstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;

  return createPdf(objects);
}