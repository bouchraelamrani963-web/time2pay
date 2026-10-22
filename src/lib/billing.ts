import "server-only";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type Plan = "STARTER" | "PRO" | "BUSINESS";

export const BILLING_PLANS = {
  STARTER: { name: "Starter", amountCents: 900, monthlyLimit: 30, priceEnv: "STRIPE_PRICE_STARTER" },
  PRO: { name: "Pro", amountCents: 1900, monthlyLimit: null, priceEnv: "STRIPE_PRICE_PRO" },
  BUSINESS: { name: "Business", amountCents: 3900, monthlyLimit: null, priceEnv: "STRIPE_PRICE_BUSINESS" },
} as const;

export const isBillingEnforced = () => process.env.BILLING_ENFORCEMENT_ENABLED === "true";

export function planForPrice(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  for (const plan of Object.keys(BILLING_PLANS) as Plan[]) {
    if (process.env[BILLING_PLANS[plan].priceEnv] === priceId) return plan;
  }
  return null;
}

export function activeEntitlement(account: {
  plan: string | null;
  status: string;
  paidThrough: Date | null;
  periodEnd: Date | null;
} | null): account is NonNullable<typeof account> {
  return !!account &&
    (account.status === "active" || account.status === "trialing") &&
    !!account.plan && account.plan in BILLING_PLANS &&
    !!account.paidThrough && account.paidThrough.getTime() > Date.now() &&
    !!account.periodEnd && account.periodEnd.getTime() > Date.now();
}

export async function getBillingView(uid: string) {
  if (!isBillingEnforced()) return { enabled: false, canFinalize: true, plan: null as Plan | null, remaining: null as number | null };
  const account = await prisma.billingAccount.findUnique({ where: { userId: uid } });
  const canFinalize = activeEntitlement(account);
  const plan = canFinalize ? account.plan as Plan : null;
  return {
    enabled: true,
    canFinalize,
    plan,
    remaining: canFinalize && plan === "STARTER" ? Math.max(0, 30 - account.issuedCount) : null,
  };
}

export class BillingGateError extends Error {
  constructor(message: string, public readonly code = "SUBSCRIPTION_REQUIRED", public readonly statusCode = 402) {
    super(message);
  }
}

export function billingErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof BillingGateError)) return null;
  return NextResponse.json({
    error: error.code, message: error.message,
    billingUrl: "/billing",
  }, { status: error.statusCode });
}

/**
 * Atomic first issuance, shared by sending, print, download, and manual status updates.
 * Default-disabled while Stripe and database migration are being configured.
 */
export async function claimInvoiceIssue(userId: string, invoiceId: string): Promise<void> {
  if (!isBillingEnforced()) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, userId }, select: { id: true, issuedAt: true } });
        if (!invoice) throw new BillingGateError("Factuur niet gevonden.", "INVOICE_NOT_FOUND", 404);
        const account = await tx.billingAccount.findUnique({ where: { userId } });
        if (!activeEntitlement(account)) throw new BillingGateError("Kies eerst een actief abonnement om deze factuur te gebruiken.");
        if (invoice.issuedAt) return;

        // A per-user billing row is atomically locked through this conditional counter.
        const increment = await tx.billingAccount.updateMany({
          where: {
            userId,
            status: { in: ["active", "trialing"] },
            paidThrough: { gt: new Date() },
            periodEnd: { gt: new Date() },
            periodStart: { lte: new Date() },
            ...(account!.plan === "STARTER" ? { issuedCount: { lt: 30 } } : {}),
          },
          data: { issuedCount: { increment: 1 } },
        });
        if (increment.count !== 1) throw new BillingGateError(
          account!.plan === "STARTER" ? "De limiet van 30 facturen in deze abonnementsperiode is bereikt." : "Abonnement is niet actief.",
          "BILLING_LIMIT", 402
        );

        const issue = await tx.invoice.updateMany({
          where: { id: invoiceId, userId, issuedAt: null },
          data: { issuedAt: new Date() },
        });
        if (issue.count !== 1) throw new BillingGateError("Factuur is al uitgegeven; probeer opnieuw.", "ISSUE_CONFLICT", 409);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
}
