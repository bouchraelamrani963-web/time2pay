import "server-only";
import { randomUUID } from "node:crypto";
import { calcInvoiceTotals } from "../calculations";
import { ortPermissionError } from "../shift-rates";
import { audit, BusinessError, conflict, denied, missing, requireRecentOwner, visibleInvoices, type CompanyContext } from "./access";
import { deliverBusinessInvoice, invoiceDocument } from "./delivery";
import { settingsSchema, type BusinessAction } from "./contracts";

const invoiceInclude = { items: { orderBy: { sortOrder: "asc" as const } } };
const clientDetails = { id: true, name: true, email: true, phone: true, address: true, vatNumber: true, shiftRates: true, ortAgreed: true } as const;
const clientBasic = { id: true, name: true, shiftRates: true, ortAgreed: true } as const;

export async function companyDashboard({ tx, company, actor, role, active }: CompanyContext, requestedPage = 1) {
  const { id, name } = company;
  const owner = role === "OWNER";
  const employee = role === "EMPLOYEE";
  const invoiceWhere = visibleInvoices(id, role, actor.uid);
  const pageSize = 25;
  const pages = Math.max(1, Math.ceil(await tx.invoice.count({ where: invoiceWhere }) / pageSize));
  const page = Math.min(requestedPage, pages);
  const [clients, invoices, seats] = await Promise.all([
    tx.client.findMany({ where: { companyId: id }, select: employee ? clientBasic : clientDetails, orderBy: { name: "asc" } }),
    tx.invoice.findMany({ where: invoiceWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize, take: pageSize, select: {
      id: true, number: true, clientId: true, status: true, dueDate: true, finalizedAt: true, issueDate: true, paidAt: true,
      businessSentAt: true, reminderCount: true, total: true, vatRate: true, ortAgreed: true, items: invoiceInclude.items,
    } }),
    owner ? tx.businessSeat.findMany({
      where: { companyId: id, OR: [{ userUid: { not: null } }, { expiresAt: { gt: new Date() } }] },
      select: { id: true, role: true, email: true, expiresAt: true }, orderBy: { slot: "asc" },
    }) : null,
  ]);
  const report = employee ? null : await tx.invoice.groupBy({
    by: ["status"], where: { companyId: id, status: { in: ["SENT", "OVERDUE", "PAID"] } },
    _sum: { subtotal: true, total: true }, _count: { _all: true },
  });
  return {
    id, name, role, active, clients, invoices, seats, report, page, pages, createdAt: company.createdAt,
    ownerEmail: owner ? actor.verifiedEmail : null,
    settings: owner ? company.settings : null,
    invoicePrefix: owner ? company.invoicePrefix : null,
    invoiceTemplate: owner ? company.invoiceTemplate : null,
  };
}

export async function changeSettings(context: CompanyContext, input: Extract<BusinessAction, { action: "settings" }>) {
  const { tx, actor, company, role } = context;
  requireRecentOwner(role, actor);
  const { settings, invoicePrefix, invoiceTemplate } = input;
  await tx.businessCompany.update({ where: { id: company.id }, data: {
    name: settings.companyName, settings, invoicePrefix, invoiceTemplate: invoiceTemplate || null,
  } });
  const previous = settingsSchema.safeParse(company.settings);
  await audit(tx, company.id, actor.uid, "COMPANY_SETTINGS_UPDATED");
  if (!previous.success || previous.data.iban !== settings.iban) {
    await audit(tx, company.id, actor.uid, "COMPANY_IBAN_UPDATED");
  }
}

export async function changeClient(
  { tx, company, role, actor }: CompanyContext,
  input: Extract<BusinessAction, { action: "client" | "deleteClient" }>,
) {
  if (role === "EMPLOYEE" || (input.action === "deleteClient" && role !== "OWNER")) throw denied();
  const companyId = company.id;
  if (input.clientId && !await tx.client.findFirst({ where: { id: input.clientId, companyId }, select: { id: true } })) {
    throw missing();
  }
  if (input.action === "deleteClient") {
    if (await tx.invoice.count({ where: { companyId, clientId: input.clientId } })) {
      throw conflict("Deze klant is gekoppeld aan een factuur en kan niet worden verwijderd.");
    }
    await tx.client.delete({ where: { id: input.clientId } });
    await audit(tx, companyId, actor.uid, "CLIENT_DELETED", input.clientId);
    return;
  }
  const { name, email, phone, address, vatNumber, shiftRates, ortAgreed } = input.client;
  const data = { name, email: email || null, phone: phone || null, address: address || null,
    vatNumber: vatNumber || null, shiftRates, ortAgreed };
  const client = input.clientId
    ? await tx.client.update({ where: { id: input.clientId }, data, select: { id: true } })
    : await tx.client.create({ data: { ...data, companyId }, select: { id: true } });
  await audit(tx, companyId, actor.uid, input.clientId ? "CLIENT_UPDATED" : "CLIENT_CREATED", client.id);
  return client;
}

export async function changeDraft(
  { tx, company, role, actor }: CompanyContext,
  input: Extract<BusinessAction, { action: "draft" | "deleteDraft" }>,
) {
  const companyId = company.id;
  if (input.action === "deleteDraft" && role !== "OWNER") throw denied();
  const existing = input.invoiceId && await tx.invoice.findFirst({
    where: { ...visibleInvoices(companyId, role, actor.uid), id: input.invoiceId, status: "DRAFT" }, select: { id: true },
  });
  if (input.invoiceId && !existing) throw missing();
  if (input.action === "deleteDraft") {
    if (!existing) throw missing();
    await tx.invoice.delete({ where: { id: existing.id } });
    await audit(tx, companyId, actor.uid, "DRAFT_DELETED", existing.id);
    return;
  }
  const { clientId, vatRate, items, ortAgreed, dueDate } = input.invoice;
  const client = await tx.client.findFirst({ where: { id: clientId, companyId }, select: { ortAgreed: true } });
  if (!client) throw missing();
  const ortError = ortPermissionError(items, ortAgreed, client.ortAgreed);
  if (ortError) throw new BusinessError(422, ortError);
  const { subtotal, vatAmount, total, items: totals } = calcInvoiceTotals(items, vatRate);
  const lines = totals.map((item, index) => ({ ...item, sortOrder: index, serviceType: items[index].serviceType }));
  const data = { clientId, dueDate: new Date(dueDate), vatRate, subtotal, vatAmount, total, ortAgreed };
  return existing
    ? tx.invoice.update({ where: { id: existing.id }, data: { ...data, items: { deleteMany: {}, create: lines } }, select: { id: true } })
    : tx.invoice.create({
      data: { ...data, companyId, number: `D-${randomUUID()}`, createdByUid: actor.uid, items: { create: lines } },
      select: { id: true },
    });
}

const businessDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" });
const clientSnapshotSelect = { name: true, email: true, address: true, vatNumber: true } as const;

export async function changeFinalInvoice(
  { tx, company, role, actor }: CompanyContext,
  input: Extract<BusinessAction, { action: "finalize" | "send" | "remind" | "cancel" | "payment" }>,
) {
  if (role === "EMPLOYEE" || (input.action === "cancel" && role !== "OWNER")) throw denied();
  const invoice = await tx.invoice.findFirst({
    where: { id: input.invoiceId, companyId: company.id },
    include: { ...invoiceInclude, client: { select: clientSnapshotSelect } },
  });
  if (!invoice) throw missing();
  if (input.action === "finalize") {
    if (invoice.finalizedAt) return;
    const parsed = settingsSchema.safeParse(company.settings);
    if (!parsed.success) throw conflict("De eigenaar moet eerst de bedrijfs- en bankgegevens invullen.");
    const issueDate = new Date();
    if (invoice.dueDate.toISOString().slice(0, 10) < businessDate.format(issueDate)) {
      throw conflict("Kies een vervaldatum op of na de factuurdatum.");
    }
    const year = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", year: "numeric" }).format(issueDate);
    const number = `${company.invoicePrefix}-${year}-${String(company.nextInvoiceNumber).padStart(5, "0")}`;
    await tx.businessCompany.update({ where: { id: company.id }, data: { nextInvoiceNumber: { increment: 1 } } });
    await tx.invoice.update({ where: { id: invoice.id }, data: {
      number, issueDate, status: "SENT", finalizedAt: issueDate, notes: company.invoiceTemplate,
      issuerSnapshot: parsed.data, clientSnapshot: invoice.client,
    } });
    await audit(tx, company.id, actor.uid, "INVOICE_FINALIZED", invoice.id);
    return;
  }
  if (!invoice.finalizedAt || invoice.status === "CANCELLED") throw conflict("Deze factuur is niet beschikbaar voor deze handeling.");
  if (input.action === "payment") {
    await tx.invoice.update({ where: { id: invoice.id }, data: {
      status: input.paid ? "PAID" : "SENT", paidAt: input.paid ? invoice.paidAt ?? new Date() : null,
    } });
    await audit(tx, company.id, actor.uid, input.paid ? "PAYMENT_RECORDED" : "PAYMENT_REVERSED", invoice.id);
  } else if (input.action === "cancel") {
    if (invoice.status === "PAID") throw conflict("Draai de betalingsregistratie eerst terug.");
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED" } });
    await audit(tx, company.id, actor.uid, "INVOICE_CANCELLED", invoice.id);
  } else {
    const reminder = input.action === "remind";
    if (!reminder && invoice.businessSentAt) return;
    if (reminder && (!invoice.businessSentAt || invoice.status === "PAID" || invoice.dueDate.toISOString().slice(0, 10) >= businessDate.format(new Date()))) {
      throw conflict("Herinneringen zijn beschikbaar voor verstuurde, verlopen en onbetaalde facturen.");
    }
    if (reminder && invoice.reminderSentAt && Date.now() - invoice.reminderSentAt.getTime() < 86400000) {
      throw conflict("Er is de afgelopen 24 uur al een herinnering verstuurd.");
    }
    const deliveryKey = reminder ? `business/reminder/${invoice.id}/${invoice.reminderCount + 1}` : `business/invoice/${invoice.id}`;
    await deliverBusinessInvoice(invoiceDocument(invoice), reminder, deliveryKey);
    await tx.invoice.update({ where: { id: invoice.id }, data: reminder
      ? { reminderSentAt: new Date(), reminderCount: { increment: 1 } }
      : { businessSentAt: new Date() },
    });
    await audit(tx, company.id, actor.uid, reminder ? "REMINDER_SENT" : "INVOICE_SENT", invoice.id);
  }
}

export async function companyInvoicePdf({ tx, company, role }: CompanyContext, invoiceId: string) {
  if (role === "EMPLOYEE") throw denied();
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, companyId: company.id, finalizedAt: { not: null } }, include: invoiceInclude,
  });
  if (!invoice) throw missing();
  return invoiceDocument(invoice);
}
