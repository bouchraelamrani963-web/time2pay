export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
export type ItemType = "HOURS" | "M2" | "MATERIAL" | "FIXED";

export interface Client {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  vatNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  type: ItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string | null;
  lineTotal: number;
  sortOrder: number;
}

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  client: Client;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  notes?: string | null;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  items: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoicePayload {
  clientId: string;
  dueDate: string;
  notes?: string;
  vatRate: number;
  items: {
    type: ItemType;
    description: string;
    quantity: number;
    unitPrice: number;
    unit?: string;
    sortOrder: number;
  }[];
}

export interface CreateClientPayload {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  vatNumber?: string;
}

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Concept",
  SENT: "Verzonden",
  PAID: "Betaald",
  OVERDUE: "Te laat",
  CANCELLED: "Geannuleerd",
};

export const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-orange-100 text-orange-700",
};

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  HOURS: "Uren",
  M2: "Per m²",
  MATERIAL: "Materiaal",
  FIXED: "Vast bedrag",
};
