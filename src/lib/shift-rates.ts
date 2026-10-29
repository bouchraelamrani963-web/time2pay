import { z } from "zod";

export const SHIFT_TYPES = ["DAY", "EVENING", "WEEKEND", "NIGHT", "HOLIDAY"] as const;
export type ShiftType = typeof SHIFT_TYPES[number];
export const SHIFT_LABELS: Record<ShiftType, string> = {
  DAY: "Dagdienst", EVENING: "Avonddienst", WEEKEND: "Weekenddienst",
  NIGHT: "Nachtdienst", HOLIDAY: "Feestdag",
};
export type ShiftRates = Partial<Record<ShiftType, number | null>>;
const rate = z.number().finite().min(0).max(100000).multipleOf(0.01).nullable().optional();
export const ShiftRatesSchema = z.object({ DAY: rate, EVENING: rate, WEEKEND: rate, NIGHT: rate, HOLIDAY: rate }).strict();
export const ClientPricingSchema = z.object({ shiftRates: ShiftRatesSchema.default({}), ortAgreed: z.boolean().default(false) });
export const InvoiceItemSchema = z.object({
  type: z.enum(["HOURS", "M2", "MATERIAL", "FIXED"]),
  description: z.string().trim().min(1).max(2000),
  quantity: z.number().finite().min(0).max(100000).multipleOf(0.0001),
  unitPrice: z.number().finite().min(0).max(100000).multipleOf(0.01),
  unit: z.string().max(40).optional(),
  serviceType: z.enum(SHIFT_TYPES).nullable().optional(),
  ortPerc: z.union([z.literal(0), z.literal(25), z.literal(50), z.literal(100)]).default(0),
  sortOrder: z.number().int().default(0),
}).superRefine((item, ctx) => {
  if (item.type !== "HOURS" && (item.ortPerc !== 0 || item.serviceType)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Diensttarieven en ORT zijn alleen toegestaan voor uren." });
  }
});

export function normalizeShiftRates(value: unknown): ShiftRates {
  const result = ShiftRatesSchema.safeParse(value);
  return result.success ? result.data : {};
}
export function shiftLabel(value: string | null | undefined): string {
  return SHIFT_TYPES.includes(value as ShiftType) ? SHIFT_LABELS[value as ShiftType] : "";
}
export function hourlyRate(rates: unknown, service: ShiftType, ortEnabled = false): number | null {
  return normalizeShiftRates(rates)[ortEnabled ? "DAY" : service] ?? null;
}
export function pricingFromForm(form: FormData) {
  return {
    shiftRates: Object.fromEntries(SHIFT_TYPES.map(type => {
      const value = String(form.get(`rate_${type}`) ?? "").trim();
      return [type, value === "" ? null : Number(value.replace(",", "."))];
    })),
    ortAgreed: form.get("ortAgreed") === "on",
  };
}
export function ortPermissionError(items: { ortPerc?: number }[], invoiceAgreed: boolean, clientAgreed: boolean) {
  return (invoiceAgreed || items.some(item => (item.ortPerc ?? 0) > 0)) && !(invoiceAgreed && clientAgreed)
    ? "ORT vereist een vastgelegde klantafspraak en moet voor deze factuur worden aangezet." : null;
}
