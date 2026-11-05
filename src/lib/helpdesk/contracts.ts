export const statuses = { OPEN: "Open", IN_PROGRESS: "In behandeling", WAITING_CUSTOMER: "Wacht op klant", RESOLVED: "Afgehandeld" } as const;
export const priorities = { LOW: "Laag", NORMAL: "Normaal", HIGH: "Hoog" } as const;
export const categories = { ACCOUNT: "Account en inloggen", MFA: "Tweestapsverificatie", HOURS: "Urenregistratie", INVOICE: "Factureren", BILLING: "Abonnementen", OTHER: "Overig" } as const;
export type TicketStatus = keyof typeof statuses;
export type TicketPriority = keyof typeof priorities;
export type TicketCategory = keyof typeof categories;
export interface TicketSummary {
  id: string; number: string; subject: string; category: TicketCategory; status: TicketStatus;
  priority: TicketPriority; customerName: string; customerEmail: string; createdAt: string; updatedAt: string;
}
export interface TicketMessage { id: string; body: string; fromSupport: boolean; createdAt: string }
export interface TicketDetail extends TicketSummary { messages: TicketMessage[]; hasOlderMessages: boolean }
export interface TicketList {
  tickets: TicketSummary[]; page: number; total: number;
  counts: Record<TicketStatus, number>;
}
