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
const MARGIN = 48;
const BOTTOM_MARGIN = 54;
const BLUE = "0.149 0.388 0.922";
const DARK = "0.067 0.094 0.153";
const MUTED = "0.294 0.345 0.416";
const LIGHT_TEXT = "0.588 0.620 0.678";
const BORDER = "0.878 0.906 0.941";
const SOFT_BG = "0.973 0.976 0.980";

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

const numberFormatter = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

type FontName = "F1" | "F2";
type Align = "left" | "right" | "center";

type PdfPage = {
  commands: string[];
};

function formatEuro(value: number) {
  return currencyFormatter.format(value).replace(/\s/g, " ");
}

function formatQuantity(item: PdfInvoiceItem) {
  if (item.type === "FIXED") return "-";
  return `${numberFormatter.format(item.quantity)} ${item.unit ?? ""}`.trim();
}

function normalizePdfText(value: string) {
  return value
    .replace(/–|—/g, "-")
    .replace(/•/g, "-")
    .replace(/[\u0100-\u20AB\u20AD-\uFFFF]/g, "?");
}

function escapePdfText(value: string) {
  return normalizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/€/g, "\\200");
}

function textWidth(text: string, size: number) {
  return normalizePdfText(text).replace(/€/g, "E").length * size * 0.52;
}

function wrapText(value: string, maxWidth: number, size: number) {
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
      if (textWidth(candidate, size) > maxWidth && current) {
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

function drawText(
  page: PdfPage,
  text: string,
  x: number,
  y: number,
  options: { size?: number; font?: FontName; color?: string; align?: Align } = {}
) {
  const size = options.size ?? 10;
  const font = options.font ?? "F1";
  const color = options.color ?? DARK;
  const align = options.align ?? "left";
  let tx = x;

  if (align === "right") tx = x - textWidth(text, size);
  if (align === "center") tx = x - textWidth(text, size) / 2;

  page.commands.push(`BT /${font} ${size} Tf ${color} rg ${tx.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`);
}

function drawLine(page: PdfPage, x1: number, y1: number, x2: number, y2: number, color = BORDER, width = 1) {
  page.commands.push(`${color} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
}

function fillRect(page: PdfPage, x: number, y: number, width: number, height: number, color: string) {
  page.commands.push(`${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
}

function strokeRect(page: PdfPage, x: number, y: number, width: number, height: number, color = BORDER) {
  page.commands.push(`${color} RG 1 w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
}

function newPage(pages: PdfPage[]) {
  const page: PdfPage = { commands: [] };
  pages.push(page);
  return page;
}

function drawPageTop(page: PdfPage, invoiceNumber: string, pageNumber: number) {
  drawText(page, "Time", MARGIN, PAGE_HEIGHT - 52, { size: 22, font: "F2", color: BLUE });
  drawText(page, "2Pay", MARGIN + 50, PAGE_HEIGHT - 52, { size: 22, font: "F2", color: DARK });
  drawText(page, `Factuur ${invoiceNumber}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 52, {
    size: 12,
    font: "F2",
    align: "right",
  });
  if (pageNumber > 1) {
    drawText(page, `Pagina ${pageNumber}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 69, {
      size: 9,
      color: MUTED,
      align: "right",
    });
  }
  drawLine(page, MARGIN, PAGE_HEIGHT - 82, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 82);
}

function drawSectionTitle(page: PdfPage, title: string, x: number, y: number) {
  drawText(page, title, x, y, { size: 9, font: "F2", color: LIGHT_TEXT });
}

function drawWrappedBlock(page: PdfPage, text: string, x: number, y: number, maxWidth: number, size = 10, lineHeight = 14) {
  const lines = wrapText(text, maxWidth, size);
  lines.forEach((line, index) => {
    if (line) drawText(page, line, x, y - index * lineHeight, { size, color: MUTED });
  });
  return lines.length * lineHeight;
}

function tableHeader(page: PdfPage, y: number) {
  const tableX = MARGIN;
  const tableW = PAGE_WIDTH - MARGIN * 2;
  const headerH = 26;
  fillRect(page, tableX, y - headerH + 7, tableW, headerH, SOFT_BG);
  drawLine(page, tableX, y - headerH + 7, tableX + tableW, y - headerH + 7, BORDER);

  drawText(page, "Type", 56, y - 10, { size: 9, font: "F2", color: MUTED });
  drawText(page, "Omschrijving", 128, y - 10, { size: 9, font: "F2", color: MUTED });
  drawText(page, "Aantal", 390, y - 10, { size: 9, font: "F2", color: MUTED, align: "right" });
  drawText(page, "Prijs", 460, y - 10, { size: 9, font: "F2", color: MUTED, align: "right" });
  drawText(page, "Totaal", 547, y - 10, { size: 9, font: "F2", color: MUTED, align: "right" });
}

function renderInvoicePdf(invoice: PdfInvoice, senderName: string) {
  const pages: PdfPage[] = [];
  let page = newPage(pages);
  let pageNumber = 1;
  let y = PAGE_HEIGHT - 110;

  const ensureSpace = (height: number, withTableHeader = false) => {
    if (y - height >= BOTTOM_MARGIN) return;
    page = newPage(pages);
    pageNumber += 1;
    drawPageTop(page, invoice.number, pageNumber);
    y = PAGE_HEIGHT - 108;
    if (withTableHeader) {
      tableHeader(page, y);
      y -= 34;
    }
  };

  drawPageTop(page, invoice.number, pageNumber);
  drawText(page, invoice.number, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 112, { size: 20, font: "F2", align: "right" });
  drawText(page, `Factuurdatum: ${dateFormatter.format(invoice.issueDate)}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 135, {
    size: 10,
    color: MUTED,
    align: "right",
  });
  drawText(page, `Vervaldatum: ${dateFormatter.format(invoice.dueDate)}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 151, {
    size: 10,
    color: MUTED,
    align: "right",
  });

  y = PAGE_HEIGHT - 185;
  const sectionGap = 245;
  drawSectionTitle(page, "AFZENDER", MARGIN, y);
  drawSectionTitle(page, "KLANT", MARGIN + sectionGap, y);
  y -= 20;

  drawText(page, senderName, MARGIN, y, { size: 11, font: "F2" });
  drawText(page, invoice.client.name, MARGIN + sectionGap, y, { size: 11, font: "F2" });
  y -= 17;

  drawText(page, "Time2Pay", MARGIN, y, { size: 10, color: MUTED });
  let senderHeight = 15;
  let clientHeight = 0;
  if (invoice.client.address?.trim()) {
    clientHeight += drawWrappedBlock(page, invoice.client.address, MARGIN + sectionGap, y, 250, 10, 14);
  }
  if (invoice.client.email) {
    drawText(page, invoice.client.email, MARGIN + sectionGap, y - clientHeight, { size: 10, color: MUTED });
    clientHeight += 14;
  }
  if (invoice.client.vatNumber) {
    drawText(page, `BTW: ${invoice.client.vatNumber}`, MARGIN + sectionGap, y - clientHeight, { size: 10, color: MUTED });
    clientHeight += 14;
  }

  y -= Math.max(senderHeight, clientHeight, 28) + 28;
  drawLine(page, MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y -= 28;

  drawText(page, "Factuurregels", MARGIN, y, { size: 13, font: "F2" });
  y -= 24;
  tableHeader(page, y);
  y -= 34;

  for (const item of invoice.items) {
    const typeLabel = itemTypeLabels[item.type] || item.type;
    const descriptionLines = wrapText(item.description, 225, 10);
    const rowHeight = Math.max(28, descriptionLines.length * 13 + 14);
    ensureSpace(rowHeight + 8, true);

    const topY = y;
    drawText(page, typeLabel, 56, topY, { size: 10, color: MUTED });
    descriptionLines.forEach((line, index) => {
      drawText(page, line, 128, topY - index * 13, { size: 10 });
    });
    drawText(page, formatQuantity(item), 390, topY, { size: 10, color: MUTED, align: "right" });
    drawText(page, formatEuro(item.unitPrice), 460, topY, { size: 10, color: MUTED, align: "right" });
    drawText(page, formatEuro(item.lineTotal), 547, topY, { size: 10, font: "F2", align: "right" });

    y -= rowHeight;
    drawLine(page, MARGIN, y + 7, PAGE_WIDTH - MARGIN, y + 7, "0.933 0.945 0.961", 0.6);
    y -= 6;
  }

  ensureSpace(112 + (invoice.notes?.trim() ? 90 : 0));
  y -= 14;

  const totalsX = 332;
  const totalsLabelX = totalsX;
  const totalsValueX = PAGE_WIDTH - MARGIN;
  drawText(page, "Subtotaal", totalsLabelX, y, { size: 10, color: MUTED });
  drawText(page, formatEuro(invoice.subtotal), totalsValueX, y, { size: 10, align: "right" });
  y -= 18;
  drawText(page, `BTW (${invoice.vatRate}%)`, totalsLabelX, y, { size: 10, color: MUTED });
  drawText(page, formatEuro(invoice.vatAmount), totalsValueX, y, { size: 10, align: "right" });
  y -= 14;
  drawLine(page, totalsX, y, totalsValueX, y, DARK, 1.2);
  y -= 20;
  drawText(page, "Totaal te betalen", totalsLabelX, y, { size: 12, font: "F2" });
  drawText(page, formatEuro(invoice.total), totalsValueX, y, { size: 12, font: "F2", align: "right" });

  const notes = invoice.notes?.trim();
  if (notes) {
    y -= 38;
    const noteLines = wrapText(notes, PAGE_WIDTH - MARGIN * 2 - 32, 10);
    const noteHeight = 42 + noteLines.length * 14;
    ensureSpace(noteHeight);

    fillRect(page, MARGIN, y - noteHeight + 18, PAGE_WIDTH - MARGIN * 2, noteHeight, SOFT_BG);
    strokeRect(page, MARGIN, y - noteHeight + 18, PAGE_WIDTH - MARGIN * 2, noteHeight, BORDER);
    drawText(page, "Notities / betaalinformatie", MARGIN + 16, y, { size: 11, font: "F2" });
    noteLines.forEach((line, index) => {
      if (line) drawText(page, line, MARGIN + 16, y - 22 - index * 14, { size: 10, color: MUTED });
    });
  }

  return pages;
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
  const pages = renderInvoicePdf(invoice, senderName);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  const pageRefs: string[] = [];

  pages.forEach((pdfPage) => {
    const pageObjectNumber = objects.length + 1;
    const contentObjectNumber = objects.length + 2;
    pageRefs.push(`${pageObjectNumber} 0 R`);

    const content = pdfPage.commands.join("\n");
    const contentLength = Buffer.byteLength(content, "latin1");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
    objects.push(`<< /Length ${contentLength} >>\nstream\n${content}\nendstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;

  return createPdf(objects);
}