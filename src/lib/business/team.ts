import "server-only";
import { prisma } from "../prisma";
import { audit, BusinessError, conflict, denied, hasBusiness, lockCompany, missing, type BusinessActor, type CompanyContext } from "./access";
import type { BusinessAction } from "./contracts";

const INVITATION_DURATION = 7 * 24 * 60 * 60 * 1000;

export async function listCompanies(actor: BusinessActor) {
  const [owned, memberships, invitations] = await Promise.all([
    prisma.businessCompany.findUnique({ where: { ownerUid: actor.uid }, select: { id: true, name: true } }),
    prisma.businessSeat.findMany({ where: { userUid: actor.uid }, select: {
      role: true, company: { select: { id: true, name: true, ownerUid: true } },
    } }),
    prisma.businessSeat.findMany({ where: { email: actor.verifiedEmail, userUid: null, expiresAt: { gt: new Date() } },
      select: { id: true, role: true, expiresAt: true, company: { select: { id: true, name: true } } } }),
  ]);
  return {
    companies: [...(owned ? [{ ...owned, role: "OWNER" as const }] : []),
      ...memberships.map(({ company, role }) => ({ id: company.id, name: company.name, role }))],
    invitations,
    canCreate: !owned && await hasBusiness(actor.uid),
  };
}

export async function createCompany(actor: BusinessActor, name: string) {
  if (!await hasBusiness(actor.uid)) throw new BusinessError(402, "Een actief Business-abonnement is vereist.");
  return prisma.$transaction(async tx => {
    await lockCompany(tx, `owner:${actor.uid}`);
    if (await tx.businessCompany.findUnique({ where: { ownerUid: actor.uid }, select: { id: true } })) {
      throw conflict("Je beheert al een Business-omgeving.");
    }
    const company = await tx.businessCompany.create({ data: { name, ownerUid: actor.uid }, select: { id: true } });
    await audit(tx, company.id, actor.uid, "COMPANY_CREATED");
    return company;
  });
}

export async function acceptInvite(actor: BusinessActor, companyId: string, seatId: string) {
  const seat = await prisma.businessSeat.findFirst({
    where: { id: seatId, companyId, email: actor.verifiedEmail, userUid: null, expiresAt: { gt: new Date() } },
    select: { company: { select: { ownerUid: true } } },
  });
  if (!seat) throw missing();
  if (!await hasBusiness(seat.company.ownerUid)) throw new BusinessError(402, "Deze Business-omgeving is gepauzeerd.");

  return prisma.$transaction(async tx => {
    await lockCompany(tx, companyId);
    const company = await tx.businessCompany.findUnique({ where: { id: companyId }, select: { ownerUid: true } });
    if (!company || company.ownerUid !== seat.company.ownerUid || company.ownerUid === actor.uid) throw denied();
    if (await tx.businessSeat.findUnique({ where: { companyId_userUid: { companyId, userUid: actor.uid } } })) {
      throw conflict("Je bent al lid van deze Business-omgeving.");
    }
    const changed = await tx.businessSeat.updateMany({
      where: { id: seatId, companyId, email: actor.verifiedEmail, userUid: null, expiresAt: { gt: new Date() } },
      data: { userUid: actor.uid, expiresAt: null },
    });
    if (!changed.count) throw missing();
    await audit(tx, companyId, actor.uid, "INVITATION_ACCEPTED", seatId);
    return { id: companyId };
  });
}

type TeamAction = Extract<BusinessAction, { action: "invite" | "removeSeat" | "changeRole" | "resendInvite" }>;

export async function manageTeam({ tx, company, actor, role }: CompanyContext, input: TeamAction) {
  if (role !== "OWNER") throw denied();
  const companyId = company.id;
  if (input.action === "invite" || input.action === "resendInvite") {
    const recent = await tx.businessAuditEvent.count({ where: { companyId,
      action: { in: ["INVITATION_CREATED", "INVITATION_EMAIL_REQUESTED"] },
      createdAt: { gt: new Date(Date.now() - 3600000) },
    } });
    if (recent >= 10) throw new BusinessError(429, "Probeer over een uur opnieuw een uitnodiging te versturen.");
  }
  if (input.action === "invite") {
    const email = input.email.toLowerCase();
    if (email === actor.verifiedEmail) throw conflict("De eigenaar heeft al een gebruikersplaats.");
    await tx.businessSeat.deleteMany({ where: { companyId, userUid: null, expiresAt: { lte: new Date() } } });
    const seats = await tx.businessSeat.findMany({ where: { companyId }, select: { email: true, slot: true } });
    if (seats.some(seat => seat.email === email)) throw conflict("Dit e-mailadres heeft al een plaats.");
    const slot = [2, 3, 4, 5].find(number => !seats.some(seat => seat.slot === number));
    if (!slot) throw conflict("Alle vijf gebruikersplaatsen zijn bezet of gereserveerd.");
    const seat = await tx.businessSeat.create({
      data: { companyId, email, slot, role: input.role, expiresAt: new Date(Date.now() + INVITATION_DURATION) },
      select: { id: true },
    });
    await audit(tx, companyId, actor.uid, "INVITATION_CREATED", seat.id);
    return { invitation: { email, name: company.name } };
  }

  const seat = await tx.businessSeat.findFirst({ where: { id: input.seatId, companyId } });
  if (!seat) throw missing();
  if (input.action === "resendInvite") {
    if (seat.userUid || !seat.expiresAt || seat.expiresAt <= new Date()) throw missing();
    await audit(tx, companyId, actor.uid, "INVITATION_EMAIL_REQUESTED", seat.id);
    return { invitation: { email: seat.email, name: company.name } };
  }
  if (input.action === "removeSeat") {
    await tx.businessSeat.delete({ where: { id: seat.id } });
    await audit(tx, companyId, actor.uid, seat.userUid ? "MEMBERSHIP_REVOKED" : "INVITATION_REVOKED", seat.id);
  } else {
    await tx.businessSeat.update({ where: { id: seat.id }, data: { role: input.role } });
    await audit(tx, companyId, actor.uid, "ROLE_CHANGED", seat.id);
  }
  return {};
}
