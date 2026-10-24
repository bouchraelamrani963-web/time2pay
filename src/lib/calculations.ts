export type ItemType = "HOURS" | "M2" | "MATERIAL" | "FIXED";

export interface LineItem {
  type: ItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  ortPerc?: number;
}

export interface InvoiceTotals {
  subtotal: number;
  ortAmount: number;
  vatAmount: number;
  total: number;
  items: Array<LineItem & { lineTotal: number; ortBedrag: number }>;
}

function cents(value: number) {
  return Math.round((value + Number.EPSILON * Math.abs(value)) * 100);
}
function roundedRatio(numerator: bigint, denominator: bigint) {
  return Number((numerator + denominator / BigInt(2)) / denominator);
}

export function calcLineTotal(item: LineItem): number {
  const price = cents(item.unitPrice);
  if (item.type === "FIXED") return price / 100;
  const quantity = Math.round(item.quantity * 10000);
  return roundedRatio(BigInt(price) * BigInt(quantity), BigInt(10000)) / 100;
}

/** ORT applies once to the rounded hourly base, never to other item types. */
export function calcOrtAmount(item: LineItem): number {
  if (item.type !== "HOURS") return 0;
  return roundedRatio(BigInt(cents(calcLineTotal(item))) * BigInt(item.ortPerc ?? 0), BigInt(100)) / 100;
}

export function calcInvoiceTotals(
  items: LineItem[],
  vatRate: number
): InvoiceTotals {
  const enriched = items.map((item) => ({
    ...item,
    lineTotal: calcLineTotal(item),
    ortBedrag: calcOrtAmount(item),
  }));

  const ortAmount = round2(enriched.reduce((sum, i) => sum + i.ortBedrag, 0));
  const subtotal = round2(enriched.reduce((sum, i) => sum + i.lineTotal + i.ortBedrag, 0));
  const vatAmount = round2(subtotal * (vatRate / 100));
  const total = round2(subtotal + vatAmount);

  return { subtotal, ortAmount, vatAmount, total, items: enriched };
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
  return cents(n) / 100;
}
