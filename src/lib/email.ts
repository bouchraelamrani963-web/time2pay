import { Resend } from "resend";

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export function getInvoiceEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.INVOICE_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    throw new EmailConfigurationError(
      "RESEND_API_KEY en INVOICE_FROM_EMAIL moeten ingesteld zijn."
    );
  }

  return {
    resend: new Resend(apiKey),
    from,
  };
}
