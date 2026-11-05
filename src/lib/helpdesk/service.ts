import "server-only";
import { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTicketSchema, HelpdeskError, listSchema, replySchema, replyStatus, ticketScope, updateTicketSchema } from "./policy";
import type { TicketDetail, TicketList, TicketStatus, TicketSummary } from "./contracts";
const summarySelect = { id: true, sequence: true, subject: true, category: true, status: true, priority: true,
  customerName: true, customerEmail: true, createdAt: true, updatedAt: true } satisfies Prisma.SupportTicketSelect;
type Summary = Prisma.SupportTicketGetPayload<{ select: typeof summarySelect }>;
function serialize(ticket: Summary): TicketSummary {
  const { sequence, ...rest } = ticket;
  return { ...rest, number: `TP-${String(sequence).padStart(5, "0")}`, createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString() };
}
export async function isSupportAgent(uid: string) {
  return (await prisma.supportAgent.findUnique({ where: { userId: uid }, select: { enabled: true } }))?.enabled === true;
}
export async function requireSupportAgent(uid: string) {
  if (!await isSupportAgent(uid)) throw new HelpdeskError(403, "Geen toegang tot Time2Pay Support.");
}
export async function listTickets(user: SessionUser, staff: boolean, input: unknown): Promise<TicketList> {
  if (staff) await requireSupportAgent(user.uid);
  const { page, status, priority, q } = listSchema.parse(input);
  const scope = ticketScope(user.uid, staff);
  const where: Prisma.SupportTicketWhereInput = { ...scope, ...(status ? { status } : {}), ...(priority ? { priority } : {}),
    ...(q ? { OR: [{ subject: { contains: q, mode: "insensitive" } }, { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } }, ...(/^TP-\d+$/i.test(q) && Number.isSafeInteger(Number(q.slice(3))) && Number(q.slice(3)) <= 2147483647 ? [{ sequence: Number(q.slice(3)) }] : [])] } : {}) };
  const grouping = prisma.supportTicket.groupBy({ by: ["status"], where: scope, _count: { _all: true } });
  const [tickets, total, grouped] = await Promise.all([
    prisma.supportTicket.findMany({ where, select: summarySelect, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 20, skip: (page - 1) * 20 }),
    prisma.supportTicket.count({ where }),
    grouping,
  ]);
  const counts: Record<TicketStatus, number> = { OPEN: 0, IN_PROGRESS: 0, WAITING_CUSTOMER: 0, RESOLVED: 0 };
  for (const row of grouped) counts[row.status] = row._count._all;
  return { tickets: tickets.map(serialize), total, page, counts };
}
export async function getTicket(user: SessionUser, staff: boolean, id: string, before?: string): Promise<TicketDetail> {
  if (staff) await requireSupportAgent(user.uid);
  const ticket = await prisma.supportTicket.findFirst({ where: ticketScope(user.uid, staff, id), select: summarySelect });
  if (!ticket) throw new HelpdeskError(404, "Aanvraag niet gevonden.");
  // Cursor is resolved within the authorized ticket, never as a global message lookup.
  const cursor = before ? await prisma.supportMessage.findFirst({ where: { id: before, ticketId: id }, select: { createdAt: true, id: true } }) : null;
  if (before && !cursor) throw new HelpdeskError(404, "Bericht niet gevonden.");
  const messages = await prisma.supportMessage.findMany({ where: { ticketId: ticket.id, ...(cursor ? { OR: [
    { createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } },
  ] } : {}) }, select: { id: true, body: true, fromSupport: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51 });
  return { ...serialize(ticket), hasOlderMessages: messages.length > 50,
    messages: messages.slice(0, 50).reverse().map(m => ({ ...m, createdAt: m.createdAt.toISOString() })) };
}
async function writeLock(tx: Prisma.TransactionClient, key: string) {
  // Transaction-scoped locks make burst limits and status transitions safe across instances.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
export async function createTicket(user: SessionUser, input: unknown) {
  const data = createTicketSchema.parse(input);
  const result = await prisma.$transaction(async tx => {
    await writeLock(tx, `helpdesk:user:${user.uid}`);
    const count = await tx.supportTicket.count({ where: { userId: user.uid, createdAt: { gte: new Date(Date.now() - 3600000) } } });
    if (count >= 10) throw new HelpdeskError(429, "Je hebt veel aanvragen ingediend. Probeer het over een uur opnieuw.");
    const company = await tx.companySettings.findUnique({ where: { userId: user.uid }, select: { companyName: true } });
    return tx.supportTicket.create({ data: { userId: user.uid, customerName: (company?.companyName || user.name || user.email || "Klant").slice(0, 200),
      customerEmail: (user.email || "").slice(0, 320), subject: data.subject, category: data.category,
      messages: { create: { authorId: user.uid, fromSupport: false, body: data.body } } }, select: summarySelect });
  });
  return serialize(result);
}
export async function replyToTicket(user: SessionUser, staff: boolean, id: string, input: unknown) {
  if (staff) await requireSupportAgent(user.uid);
  const data = replySchema.parse(input);
  await prisma.$transaction(async tx => {
    await writeLock(tx, `helpdesk:user:${user.uid}`);
    await writeLock(tx, `helpdesk:ticket:${id}`);
    const ticket = await tx.supportTicket.findFirst({ where: ticketScope(user.uid, staff, id), select: { id: true, status: true } });
    if (!ticket) throw new HelpdeskError(404, "Aanvraag niet gevonden.");
    const count = await tx.supportMessage.count({ where: { authorId: user.uid, createdAt: { gte: new Date(Date.now() - 600000) } } });
    if (count >= 30) throw new HelpdeskError(429, "Je hebt veel reacties geplaatst. Probeer het over tien minuten opnieuw.");
    await tx.supportMessage.create({ data: { ticketId: id, authorId: user.uid, fromSupport: staff, body: data.body } });
    await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: replyStatus(ticket.status, staff), updatedAt: new Date() } });
  });
  return getTicket(user, staff, id);
}
export async function updateTicket(user: SessionUser, id: string, input: unknown) {
  await requireSupportAgent(user.uid);
  const data = updateTicketSchema.parse(input);
  await prisma.$transaction(async tx => {
    await writeLock(tx, `helpdesk:ticket:${id}`);
    if (!await tx.supportTicket.findUnique({ where: { id }, select: { id: true } })) throw new HelpdeskError(404, "Aanvraag niet gevonden.");
    await tx.supportTicket.update({ where: { id }, data });
  });
  return getTicket(user, true, id);
}
