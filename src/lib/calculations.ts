export type ItemType = "HOURS" | "M2" | "MATERIAL" | "FIXED";

export interface LineItem {
  type: ItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
}

export interface InvoiceTotals {
  subtotal: number;
  vatAmount: number;
  total: number;
  items: Array<LineItem & { lineTotal: number }>;
}

export function calcLineTotal(item: LineItem): number {
  switch (item.type) {
    case "HOURS":
    case "M2":
    case "MATERIAL":
      return round2(item.quantity * item.unitPrice);
    case "FIXED":
      return round2(item.unitPrice);
    default:
      return 0;
  }
}

export function calcInvoiceTotals(
  items: LineItem[],
  vatRate: number
): InvoiceTotals {
  const enriched = items.map((item) => ({
    ...item,
    lineTotal: calcLineTotal(item),
  }));

  const subtotal = round2(enriched.reduce((sum, i) => sum + i.lineTotal, 0));
  const vatAmount = round2(subtotal * (vatRate / 100));
  const total = round2(subtotal + vatAmount);

  return { subtotal, vatAmount, total, items: enriched };
}

export function defaultUnit(type: ItemType): string {
  switch (type) {
    case "HOURS":
      return "uur";
    case "M2":
      return "m²";
    case "MATERIAL":
      return "st";
    case "FIXED":
      return "";
  }
}

export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `F${year}-${rand}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
