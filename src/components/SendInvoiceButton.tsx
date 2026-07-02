"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import toast from "react-hot-toast";

type SendInvoiceButtonProps = {
  invoiceId: string;
  clientEmail?: string | null;
};

type SendInvoiceResponse = {
  error?: string;
  message?: string;
  sentTo?: string;
};

async function readResponse(response: Response): Promise<SendInvoiceResponse> {
  try {
    return (await response.json()) as SendInvoiceResponse;
  } catch {
    return {};
  }
}

export default function SendInvoiceButton({ invoiceId, clientEmail }: SendInvoiceButtonProps) {
  const [isSending, setIsSending] = useState(false);

  async function sendInvoice() {
    if (isSending) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await readResponse(response);

      if (!response.ok) {
        throw new Error(body.message || body.error || "Factuur versturen mislukt.");
      }

      const sentTo = body.sentTo || clientEmail;
      toast.success(
        sentTo ? `Factuur is verstuurd naar ${sentTo}` : "Factuur is verstuurd."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Factuur versturen mislukt.";
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <button
      type="button"
      className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={sendInvoice}
      disabled={isSending}
    >
      <Send size={16} />
      {isSending ? "Versturen..." : "Factuur versturen"}
    </button>
  );
}
