import { z } from "zod";
import { categories, priorities, statuses } from "./contracts";
export class HelpdeskError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
// Secrets cannot be reliably recognized in free text. Reject recognizable code/credential
// formats and labelled values in addition to the prominent warning at both inputs.
export function containsCredential(value: string) {
  return /\b\d{6}\b|\b[A-F0-9]{4}(?:[-\s][A-F0-9]{4}){3,}\b|\b(?:wachtwoord|password|authenticatorcode|totp|herstelcode|recovery[ -]?code)\s*(?:is\b|[:=])\s*\S+/i.test(value);
}
const text = (min: number, max: number) => z.string().trim().min(min).max(max)
  .refine(v => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v), "Ongeldige tekens.")
  .refine(v => !containsCredential(v), "Verwijder wachtwoorden, authenticatorcodes en herstelcodes uit je bericht.");
export const createTicketSchema = z.object({ subject: text(3, 160), category: z.enum(Object.keys(categories) as [keyof typeof categories, ...Array<keyof typeof categories>]), body: text(10, 8000) }).strict();
export const replySchema = z.object({ body: text(1, 8000) }).strict();
export const updateTicketSchema = z.object({
  status: z.enum(Object.keys(statuses) as [keyof typeof statuses, ...Array<keyof typeof statuses>]).optional(),
  priority: z.enum(Object.keys(priorities) as [keyof typeof priorities, ...Array<keyof typeof priorities>]).optional(),
}).strict().refine(v => v.status !== undefined || v.priority !== undefined);
export const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  q: z.string().trim().max(160).default(""),
  status: z.enum(["", ...Object.keys(statuses)] as ["", ...Array<keyof typeof statuses>]).default(""),
  priority: z.enum(["", ...Object.keys(priorities)] as ["", ...Array<keyof typeof priorities>]).default(""),
});
export function ticketScope(uid: string, staff: boolean, id?: string) {
  return { ...(id ? { id } : {}), ...(staff ? {} : { userId: uid }) };
}
export function replyStatus(status: keyof typeof statuses, staff: boolean) {
  // A customer reply brings a waiting or resolved question back to Support.
  return staff ? (status === "RESOLVED" ? "RESOLVED" : "WAITING_CUSTOMER") :
    status === "WAITING_CUSTOMER" || status === "RESOLVED" ? "OPEN" : status;
}
