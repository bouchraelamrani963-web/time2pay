import type { InvoiceStatus } from "@/types/invoice";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface StatusableInvoice {
  status: InvoiceStatus;
  dueDate: string | Date;
  paidAt?: string | Date | null;
  issueDate: string | Date;
  reminderSentAt?: string | Date | null;
}

/**
 * Returns the *effective* status. A SENT invoice past its due date is
 * presented as OVERDUE even if the DB still says SENT.
 */
export function effectiveStatus(inv: StatusableInvoice): InvoiceStatus {
  if (inv.status === "SENT" && new Date(inv.dueDate).getTime() < Date.now()) {
    return "OVERDUE";
  }
  return inv.status;
}

/**
 * Whole days past due (0 if not overdue / paid in time).
 */
export function daysOverdue(inv: StatusableInvoice): number {
  if (inv.status === "PAID" || inv.status === "CANCELLED" || inv.status === "DRAFT") return 0;
  const diff = Date.now() - new Date(inv.dueDate).getTime();
  return diff > 0 ? Math.floor(diff / DAY_MS) : 0;
}

/**
 * For PAID invoices, the number of days between issue and payment.
 */
export function paymentDays(inv: StatusableInvoice): number | null {
  if (inv.status !== "PAID" || !inv.paidAt) return null;
  const diff = new Date(inv.paidAt).getTime() - new Date(inv.issueDate).getTime();
  return Math.max(0, Math.round(diff / DAY_MS));
}

/**
 * True when this paid invoice was paid AFTER its due date.
 */
export function wasPaidLate(inv: StatusableInvoice): boolean {
  if (inv.status !== "PAID" || !inv.paidAt) return false;
  return new Date(inv.paidAt).getTime() > new Date(inv.dueDate).getTime();
}

/**
 * Average payment time in days across an invoice set (PAID only).
 * Returns null when no qualifying invoices.
 */
export function avgPaymentDays(invoices: StatusableInvoice[]): number | null {
  const days = invoices.map(paymentDays).filter((d): d is number => d !== null);
  if (days.length === 0) return null;
  return Math.round(days.reduce((s, d) => s + d, 0) / days.length);
}
