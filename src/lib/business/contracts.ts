import { z } from "zod";
import { ClientPricingSchema, InvoiceItemSchema } from "../shift-rates";

const shortText = z.string().trim().min(1).max(150);
const id = z.string().min(1).max(100);
const role = z.enum(["ADMINISTRATION", "EMPLOYEE"]);
const optionalText = z.string().trim().max(500).default("");
const email = z.email().max(254);
const date = z.iso.date();
const iban = z.string().transform(value => value.replace(/\s/g, "").toUpperCase())
  .refine(value => {
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value)) return false;
    if (value.startsWith("NL") && !/^NL\d{2}[A-Z]{4}\d{10}$/.test(value)) return false;
    const rearranged = value.slice(4) + value.slice(0, 4);
    const numeric = rearranged.replace(/[A-Z]/g, letter => String(letter.charCodeAt(0) - 55));
    return BigInt(numeric) % BigInt(97) === BigInt(1);
  }, "Vul een geldig IBAN in.");

export const settingsSchema = z.object({
  companyName: shortText, contactName: shortText, street: shortText, postalCode: shortText,
  city: shortText, kvkNumber: z.string().trim().regex(/^\d{8}$/), vatId: shortText,
  iban, email, phone: optionalText,
  pdfStyle: z.enum(["CLASSIC", "NEUTRAL"]).default("CLASSIC"),
}).strict();

const clientSchema = ClientPricingSchema.extend({
  name: shortText, email: z.union([email, z.literal("")]).default(""),
  phone: optionalText, address: optionalText, vatNumber: optionalText,
}).strict();

const invoiceSchema = z.object({
  clientId: id, dueDate: date, vatRate: z.number().min(0).max(100).multipleOf(0.01),
  ortAgreed: z.boolean().default(false),
  items: z.array(InvoiceItemSchema).min(1).max(100),
}).strict();

export const businessAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createCompany"), name: shortText }).strict(),
  z.object({ action: z.literal("invite"), email, role }).strict(),
  z.object({ action: z.literal("accept"), seatId: id }).strict(),
  z.object({ action: z.literal("removeSeat"), seatId: id }).strict(),
  z.object({ action: z.literal("changeRole"), seatId: id, role }).strict(),
  z.object({ action: z.literal("resendInvite"), seatId: id }).strict(),
  z.object({ action: z.literal("settings"), settings: settingsSchema,
    invoicePrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,12}$/),
    invoiceTemplate: z.string().trim().max(500).default(""),
  }).strict(),
  z.object({ action: z.literal("client"), clientId: id.optional(), client: clientSchema }).strict(),
  z.object({ action: z.literal("deleteClient"), clientId: id }).strict(),
  z.object({ action: z.literal("draft"), invoiceId: id.optional(), invoice: invoiceSchema }).strict(),
  z.object({ action: z.literal("deleteDraft"), invoiceId: id }).strict(),
  z.object({ action: z.enum(["finalize", "send", "remind", "cancel"]), invoiceId: id }).strict(),
  z.object({ action: z.literal("payment"), invoiceId: id, paid: z.boolean() }).strict(),
]);

export type BusinessAction = z.infer<typeof businessAction>;
export type BusinessRole = "OWNER" | z.infer<typeof role>;
export const roleLabel: Record<BusinessRole, string> = {
  OWNER: "Eigenaar", ADMINISTRATION: "Administratie", EMPLOYEE: "Medewerker",
};
export const BUSINESS_SEATS = 5;
