import "server-only";
import type { Prisma } from "@prisma/client";
import { getPaidEntitlement } from "../billing";
import { isRecentSignIn } from "../auth-policy";
import { prisma } from "../prisma";
import type { BusinessRole } from "./contracts";

export type BusinessActor = { uid: string; verifiedEmail: string; authTime: number };
export class BusinessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const denied = () => new BusinessError(403, "Je hebt geen toegang tot deze handeling.");
export const missing = () => new BusinessError(404, "Dit onderdeel is niet gevonden.");
export const conflict = (message: string) => new BusinessError(409, message);

export function businessEnabled() {
  return process.env.TIME2PAY_BUSINESS_ENABLED === "true";
}

export async function hasBusiness(ownerUid: string) {
  return (await getPaidEntitlement(ownerUid))?.plan === "business";
}

export function requireRecentOwner(role: BusinessRole, actor: BusinessActor) {
  if (role !== "OWNER") throw denied();
  if (!isRecentSignIn(actor.authTime)) {
    throw new BusinessError(403, "Meld je opnieuw aan met je authenticator om deze instellingen te wijzigen.");
  }
}

export function visibleInvoices(companyId: string, role: BusinessRole, uid: string): Prisma.InvoiceWhereInput {
  return role === "EMPLOYEE" ? { companyId, createdByUid: uid, status: "DRAFT" } : { companyId };
}

export async function lockCompany(tx: Prisma.TransactionClient, companyId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('time2pay-business'), hashtext(${companyId}))`;
}

export function audit(tx: Prisma.TransactionClient, companyId: string, actorUid: string, action: string, targetId?: string) {
  return tx.businessAuditEvent.create({ data: { companyId, actorUid, action, targetId } });
}

// Entitlements are refreshed from the existing billing source. Membership is
// checked again under the same lock used to revoke access and change roles.
export async function withCompany<T>(
  companyId: string,
  actor: BusinessActor,
  run: (context: CompanyContext) => Promise<T>,
) {
  const company = await prisma.businessCompany.findFirst({
    where: { id: companyId, OR: [{ ownerUid: actor.uid }, { seats: { some: { userUid: actor.uid } } }] },
    select: { ownerUid: true },
  });
  if (!company) throw missing();
  const active = await hasBusiness(company.ownerUid);

  return prisma.$transaction(async tx => {
    await lockCompany(tx, companyId);
    const current = await tx.businessCompany.findUnique({ where: { id: companyId } });
    if (!current || current.ownerUid !== company.ownerUid) throw missing();
    const seat = current.ownerUid === actor.uid ? null : await tx.businessSeat.findUnique({
      where: { companyId_userUid: { companyId, userUid: actor.uid } },
    });
    const role = current.ownerUid === actor.uid ? "OWNER" : seat?.role;
    if (!role) throw missing();
    if (!active && role !== "OWNER") throw new BusinessError(402, "Deze Business-omgeving is gepauzeerd.");
    return run({ tx, company: current, actor, role, active });
  }, { timeout: 20000 });
}

export type CompanyContext = {
  tx: Prisma.TransactionClient;
  company: Prisma.BusinessCompanyGetPayload<object>;
  actor: BusinessActor;
  role: BusinessRole;
  active: boolean;
};
