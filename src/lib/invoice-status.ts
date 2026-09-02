import type { InvoiceStatus } from "@/types/invoice";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface StatusableInvoice {
  status: InvoiceStatus;
  dueDate: string | Date;
  paidAt?: string | Date | null;
  issueDate: string | Date;
  reminderSentAt?: string | Date | null;
}

function startOfLocalDay(value: string | Date): number {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Returns the *effective* UI status without rewriting the stored DB status.
 */
export function effectiveStatus(inv: StatusableInvoice): InvoiceStatus {
  if (inv.status === "PAID" || inv.status === "DRAFT" || inv.status === "CANCELLED") {
    return inv.status;
  }

  if (
    startOfLocalDay(inv.dueDate) < startOfToday()
  ) {
    return "OVERDUE";
  }

  if (inv.status === "OVERDUE") {
    return "SENT";
  }

  return inv.status;
}

/**
 * Whole days past due (0 if not overdue / paid in time).
 */
export function daysOverdue(inv: StatusableInvoice): number {
  if (effectiveStatus(inv) !== "OVERDUE") return 0;
  return Math.floor((startOfToday() - startOfLocalDay(inv.dueDate)) / DAY_MS);
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
