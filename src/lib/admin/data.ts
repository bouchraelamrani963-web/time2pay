import "server-only";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";
import { registrationTrialEnabled } from "@/lib/registration-trial";
import { freeTrial } from "@/lib/registration-trial-policy";
import { monthKey, openBillingReader, readReceivedPayments, readSubscriptions, type BillingLink, type LinkedSubscription } from "./billing-read";

const PAGE_SIZE = 25;
const MAX_USERS = 10000;
export const adminViews = ["overview", "customers", "subscriptions", "reports"] as const;
const querySchema = z.object({
  view: z.enum(adminViews).default("overview"),
  page: z.coerce.number().int().min(1).max(MAX_USERS).default(1),
  month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/).optional(),
});

export function parseAdminQuery(input: Record<string, unknown>, now = Date.now()) {
  const parsed = querySchema.safeParse(input);
  if (!parsed.success) return null;
  const current = monthKey(now);
  if (parsed.data.month && parsed.data.month > current) return null;
  const [year, month] = current.split("-").map(Number);
  return { ...parsed.data, month: parsed.data.month ?? monthKey(Date.UTC(year, month - 2, 15)) };
}

type AdminQuery = NonNullable<ReturnType<typeof parseAdminQuery>>;
type RegisteredUser = {
  uid: string;
  name: string | null;
  email: string | null;
  registeredAt: string | null;
  verified: boolean;
  disabled: boolean;
};

async function listRegisteredUsers() {
  const auth = getAdminAuth();
  const users = new Map<string, RegisteredUser>();
  let token: string | undefined;
  let scanned = 0;
  do {
    const page = await auth.listUsers(1000, token);
    scanned += page.users.length;
    if (scanned > MAX_USERS || (page.pageToken && scanned >= MAX_USERS) ||
      (page.pageToken && (page.pageToken === token || !page.users.length))) {
      throw new Error("User scan incomplete");
    }
    for (const user of page.users) {
      const registeredAt = Date.parse(user.metadata.creationTime);
      users.set(user.uid, {
        uid: user.uid, name: user.displayName ?? null, email: user.email ?? null,
        registeredAt: Number.isFinite(registeredAt) ? new Date(registeredAt).toISOString() : null,
        verified: user.emailVerified, disabled: user.disabled,
      });
    }
    token = page.pageToken;
  } while (token);
  return [...users.values()].sort((a, b) =>
    (b.registeredAt ?? "").localeCompare(a.registeredAt ?? "") || a.uid.localeCompare(b.uid));
}

async function listBillingLinks() {
  const links = await prisma.billingAccount.findMany({
    select: { userId: true, customerId: true, subscriptionId: true },
    take: MAX_USERS + 1,
  });
  if (links.length > MAX_USERS) throw new Error("Billing links incomplete");
  return links;
}

async function readSource<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch {
    // Avoid exposing provider errors, raw records or configuration to the UI.
    return null;
  }
}

function customerRow(user: RegisteredUser, link: BillingLink | undefined, linksAvailable: boolean,
  subscriptions: Map<string, LinkedSubscription> | null, now: number) {
  const { uid, ...account } = user;
  const entry = subscriptions?.get(uid);
  const subscription = entry?.summary ?? null;
  const billingKnown = linksAvailable && (!link?.subscriptionId || subscription !== null);
  const trial = registrationTrialEnabled() && !account.disabled && billingKnown && !entry?.paidAccess
    ? freeTrial(account.registeredAt ?? undefined, process.env.TIME2PAY_LAUNCHED_AT, now)
    : null;
  return {
    ...account, billingKnown, subscription,
    trialEndsAt: trial ? new Date(trial.periodEnd * 1000).toISOString() : null,
  };
}

function paginate<T>(rows: T[], requested: number) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, requested);
  const start = (page - 1) * PAGE_SIZE;
  return { rows: rows.slice(start, start + PAGE_SIZE), page, pages, total: rows.length };
}

function growthByMonth(users: RegisteredUser[], now: number) {
  if (users.some(user => !user.registeredAt)) return null;
  const [year, month] = monthKey(now).split("-").map(Number);
  const counts = new Map(Array.from({ length: 6 }, (_, i) =>
    [monthKey(Date.UTC(year, month - 7 + i, 15)), 0]));
  for (const user of users) {
    const key = monthKey(Date.parse(user.registeredAt!));
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return [...counts].map(([month, registrations]) => ({ month, registrations }));
}

export async function readAdminData(query: AdminQuery, now = Date.now()) {
  const showReports = query.view === "overview" || query.view === "reports";
  const registered = readSource(listRegisteredUsers);
  const links = readSource(listBillingLinks);
  const billing = readSource(openBillingReader);
  const sources = Promise.all([billing, links]);
  const [users, billingLinks, reader, subscriptions, tickets, revenueCents] = await Promise.all([
    registered, links, billing,
    sources.then(([source, accounts]) => source && accounts
      ? readSource(() => readSubscriptions(source, accounts, now)) : null),
    query.view === "overview"
      ? readSource(() => prisma.supportTicket.count({ where: { status: { not: "RESOLVED" } } })) : null,
    showReports ? sources.then(([source, accounts]) => source && accounts
      ? readSource(() => readReceivedPayments(source, accounts, query.month)) : null) : null,
  ]);

  const byUser = new Map(billingLinks?.map(link => [link.userId, link]));
  const rows = users?.map(user => customerRow(user, byUser.get(user.uid), billingLinks !== null, subscriptions, now)) ?? null;
  const allBillingKnown = rows?.every(row => row.billingKnown) ?? false;
  const activePlans = reader && allBillingKnown && rows ? { starter: 0, pro: 0, business: 0 } : null;
  if (activePlans) {
    for (const row of rows ?? []) {
      if (row.subscription?.status === "active") activePlans[row.subscription.plan]++;
    }
  }

  return {
    checkedAt: new Date(now).toISOString(),
    billingMode: reader ? reader.livemode ? "live" as const : "test" as const : null,
    overview: query.view === "overview" ? {
      registered: users?.length ?? null,
      active: users?.filter(user => user.verified && !user.disabled).length ?? null,
      trials: allBillingKnown && rows
        ? rows.filter(row => !row.disabled && (row.trialEndsAt || row.subscription?.status === "trialing")).length : null,
      subscriptions: activePlans ? Object.values(activePlans).reduce((sum, count) => sum + count, 0) : null,
      tickets,
      recent: rows?.slice(0, 5) ?? null,
    } : null,
    customers: query.view === "customers" && rows ? paginate(rows, query.page) : null,
    subscriptions: query.view === "subscriptions" && rows && billingLinks
      ? paginate(rows.filter(row => !row.billingKnown || row.subscription || row.trialEndsAt), query.page) : null,
    reports: showReports ? {
      growth: users ? growthByMonth(users, now) : null,
      activePlans,
      month: query.month,
      revenueCents,
    } : null,
  };
}

export type AdminData = Awaited<ReturnType<typeof readAdminData>>;
export type AdminCustomer = ReturnType<typeof customerRow>;
