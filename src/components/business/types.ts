import type { z } from "zod";
import type { settingsSchema, BusinessAction, BusinessRole } from "@/lib/business/contracts";
import type { SHIFT_TYPES, InvoiceItemSchema } from "@/lib/shift-rates";

export type Client = {
  id: string; name: string; email?: string | null; phone?: string | null;
  address?: string | null; vatNumber?: string | null; ortAgreed: boolean;
  shiftRates: Partial<Record<(typeof SHIFT_TYPES)[number], number | null>> | null;
};
export type DraftItem = z.input<typeof InvoiceItemSchema> & { id?: string };
export type Invoice = {
  id: string; clientId: string; number: string; status: "DRAFT" | "SENT" | "OVERDUE" | "PAID" | "CANCELLED";
  dueDate: string; finalizedAt: string | null; businessSentAt: string | null; reminderCount: number;
  issueDate: string; paidAt: string | null; total: number; vatRate: number; ortAgreed: boolean; items: DraftItem[];
};
export type Seat = { id: string; role: Exclude<BusinessRole, "OWNER">; email: string; expiresAt: string | null };
export type Company = { id: string; name: string; role: BusinessRole };
export type Overview = {
  companies: Company[]; canCreate: boolean;
  invitations: { id: string; role: Seat["role"]; expiresAt: string; company: Pick<Company, "id" | "name"> }[];
};
export type Dashboard = Company & {
  active: boolean; page: number; pages: number; createdAt: string; clients: Client[]; invoices: Invoice[]; seats: Seat[] | null; ownerEmail: string | null;
  settings: z.infer<typeof settingsSchema> | null; invoicePrefix: string | null; invoiceTemplate: string | null;
  report: { status: Invoice["status"]; _sum: { subtotal: number | null; total: number | null }; _count: { _all: number } }[] | null;
};
export type Submit = (input: BusinessAction) => Promise<boolean>;
