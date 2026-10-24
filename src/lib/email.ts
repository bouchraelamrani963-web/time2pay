import { Resend } from "resend";

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export function getInvoiceEmailConfig() {
  const testMode = process.env.VERCEL_ENV !== "production";
  if (testMode && process.env.TIME2PAY_EMAIL_MODE !== "test") {
    throw new EmailConfigurationError("Testmail is nog niet ingesteld.");
  }
  // Preview must use its own credential and can only send to Resend's test sink.
  const apiKey = (testMode ? process.env.RESEND_TEST_API_KEY : process.env.RESEND_API_KEY)?.trim();
  const from = testMode ? "Time2Pay test <testmail@time2pay.nl>" : process.env.INVOICE_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    throw new EmailConfigurationError(testMode
      ? "De aparte sleutel voor testmail ontbreekt."
      : "RESEND_API_KEY en INVOICE_FROM_EMAIL moeten ingesteld zijn.");
  }
  return {
    resend: new Resend(apiKey),
    from,
    testRecipient: testMode ? "delivered@resend.dev" : undefined,
  };
}
