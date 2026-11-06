import { notFound } from "next/navigation";
import { BarChart3, CalendarDays, CircleCheck, Clock3, CreditCard, Headphones, LayoutDashboard, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { requireUser } from "@/lib/auth";
import { canUsePlatformAdmin } from "@/lib/admin/access";
import { monthKey } from "@/lib/admin/billing-read";
import { parseAdminQuery, readAdminData, type AdminCustomer, type AdminData } from "@/lib/admin/data";
import "./admin.css";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = {
  title: "Beheercentrum | Time2Pay",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const navigation = [
  { id: "overview", label: "Overzicht", short: "Overzicht", href: "/admin", icon: LayoutDashboard },
  { id: "customers", label: "Klantenbeheer", short: "Klanten", href: "/admin?view=customers", icon: Users },
  { id: "subscriptions", label: "Abonnementen", short: "Abonnement", href: "/admin?view=subscriptions", icon: CreditCard },
  { id: "support", label: "Helpdesk", short: "Helpdesk", href: "/support", icon: Headphones },
  { id: "reports", label: "Rapportages", short: "Rapporten", href: "/admin?view=reports", icon: BarChart3 },
] as const;

const planNames = { starter: "Starter", pro: "Pro", business: "Business" };
const subscriptionLabels: Record<NonNullable<AdminCustomer["subscription"]>["status"], string> = {
  active: "Actief", canceled: "Beëindigd", incomplete: "In afwachting", incomplete_expired: "Verlopen",
  past_due: "Betaalachterstand", paused: "Gepauzeerd", trialing: "Proefperiode", unpaid: "Onbetaald",
};
const invoiceLabels: Record<NonNullable<NonNullable<AdminCustomer["subscription"]>["invoiceStatus"]>, string> = {
  draft: "Concept", open: "Openstaand", paid: "Betaald", uncollectible: "Oninbaar", void: "Geannuleerd",
};
const date = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeZone: "Europe/Amsterdam" });
const datetime = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" });
const fullMonth = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });
const shortMonth = new Intl.DateTimeFormat("nl-NL", { month: "short", timeZone: "Europe/Amsterdam" });
const number = new Intl.NumberFormat("nl-NL");
const euros = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const monthDate = (key: string) => new Date(`${key}-15T12:00:00Z`);
const unavailable = "Bron niet beschikbaar";

function AccountName({ account }: { account: AdminCustomer }) {
  return <><strong>{account.name || account.email || "Time2Pay-account"}</strong>
    {account.name && account.email ? <small>{account.email}</small> : null}</>;
}

function Trial({ account }: { account: AdminCustomer }) {
  if (!account.billingKnown) return <span>{unavailable}</span>;
  const stripeEnd = account.subscription?.stripeTrialEndsAt;
  if (!account.trialEndsAt && !stripeEnd) return <span>—</span>;
  return <>
    {account.trialEndsAt ? <><strong>Time2Pay-proefperiode</strong><small>Tot {date.format(new Date(account.trialEndsAt))}</small></> : null}
    {stripeEnd ? <><strong>Stripe-proefperiode</strong><small>Tot {date.format(new Date(stripeEnd))}</small></> : null}
  </>;
}

function AccountTable({ rows, billing = false }: { rows: AdminCustomer[]; billing?: boolean }) {
  if (!rows.length) return <p className="admin-empty">{billing ? "Geen gekoppelde abonnementen of lopende proefperiodes." : "Geen geregistreerde Time2Pay-gebruikers."}</p>;
  return <div className="admin-table-wrap"><table className="admin-table" aria-label={billing ? "Abonnementen en betalingen" : "Time2Pay-gebruikers"}>
    <thead><tr><th scope="col">Account</th>{billing ? <>
      <th scope="col">Abonnement</th><th scope="col">Proefperiode</th><th scope="col">Verlenging of einde</th>
      <th scope="col">Betaalstatus</th><th scope="col">Achterstand</th>
    </> : <>
      <th scope="col">Registratie</th><th scope="col">E-mailverificatie</th>
      <th scope="col">Accountstatus</th><th scope="col">Abonnement</th>
    </>}</tr></thead>
    <tbody>{rows.map((account, index) => {
      const subscription = account.subscription;
      return <tr key={index}>
        <td data-label="Account"><AccountName account={account} /></td>
        {billing ? <>
          <td data-label="Abonnement">{subscription ? <><strong>{planNames[subscription.plan]}</strong>
            <small>{subscriptionLabels[subscription.status]}</small></> : account.billingKnown ? "Geen abonnement" : unavailable}</td>
          <td data-label="Proefperiode"><Trial account={account} /></td>
          <td data-label="Verlenging of einde">{subscription?.endsAt ? `Einde ${date.format(new Date(subscription.endsAt))}`
            : subscription?.renewsAt ? `Verlenging ${date.format(new Date(subscription.renewsAt))}` : "—"}</td>
          <td data-label="Betaalstatus">{subscription?.invoiceStatus ? invoiceLabels[subscription.invoiceStatus]
            : subscription ? "Onbekend" : "—"}</td>
          <td data-label="Achterstand">{subscription?.overdueCents != null ? euros.format(subscription.overdueCents / 100)
            : subscription ? "Onbekend" : "—"}</td>
        </> : <>
          <td data-label="Registratie">{account.registeredAt ? date.format(new Date(account.registeredAt)) : "Onbekend"}</td>
          <td data-label="E-mailverificatie"><span className={account.verified ? "admin-badge verified" : "admin-badge pending"}>
            {account.verified ? "Geverifieerd" : "Nog te verifiëren"}</span></td>
          <td data-label="Accountstatus">{account.disabled ? "Uitgeschakeld" : "Ingeschakeld"}</td>
          <td data-label="Abonnement">{subscription ? <><strong>{planNames[subscription.plan]}</strong>
            <small>{subscriptionLabels[subscription.status]}</small></> : account.trialEndsAt ? <Trial account={account} />
            : account.billingKnown ? "Geen abonnement" : unavailable}</td>
        </>}
      </tr>;
    })}</tbody>
  </table></div>;
}

function Pagination({ view, data }: {
  view: "customers" | "subscriptions";
  data: NonNullable<AdminData["customers"]>;
}) {
  return <div className="admin-pagination">
    <p>{number.format(data.total)} {data.total === 1 ? "account" : "accounts"} · pagina {data.page} van {data.pages}</p>
    <div>
      {data.page > 1 ? <a className="btn-secondary" href={`/admin?view=${view}&page=${data.page - 1}`}>Vorige</a> : null}
      {data.page < data.pages ? <a className="btn-secondary" href={`/admin?view=${view}&page=${data.page + 1}`}>Volgende</a> : null}
    </div>
  </div>;
}

function Reports({ reports, billingMode }: { reports: NonNullable<AdminData["reports"]>; billingMode: AdminData["billingMode"] }) {
  const maximum = Math.max(1, ...(reports.growth?.map(item => item.registrations) ?? []));
  const total = reports.activePlans ? Object.values(reports.activePlans).reduce((sum, count) => sum + count, 0) : 0;
  return <>
    <div className="admin-report-grid">
      <section className="admin-card admin-report">
        <h3>Gebruikersgroei</h3>
        <p>Registraties van bestaande accounts per maand · Firebase</p>
        {reports.growth ? <ul className="admin-growth" aria-label="Registraties in de afgelopen zes volledige kalendermaanden">
          {reports.growth.map(({ month, registrations }) => <li key={month}>
            <span>{number.format(registrations)}</span>
            <div className="admin-growth-track" aria-hidden="true"><div style={{ height: `${registrations / maximum * 100}%` }} /></div>
            <time dateTime={month} aria-label={fullMonth.format(monthDate(month))}>{shortMonth.format(monthDate(month))}</time>
          </li>)}
        </ul> : <p className="admin-empty">{unavailable}</p>}
      </section>
      <section className="admin-card admin-report">
        <h3>Abonnementsverdeling</h3>
        <p>Actieve gekoppelde abonnementen · Stripe</p>
        {reports.activePlans ? <ul className="admin-plan-chart">
          {Object.entries(reports.activePlans).map(([key, count]) => <li key={key}>
            <div><span>{planNames[key as keyof typeof planNames]}</span><strong>{number.format(count)}</strong></div>
            <div className="admin-plan-track" aria-hidden="true"><span style={{ width: `${total ? count / total * 100 : 0}%` }} /></div>
          </li>)}
          <li className="admin-plan-total"><div><span>Totaal actief</span><strong>{number.format(total)}</strong></div></li>
        </ul> : <p className="admin-empty">{unavailable}</p>}
      </section>
    </div>
    <section className="admin-card admin-revenue">
      <div className="admin-icon"><CreditCard size={20} aria-hidden /></div>
      <div>
        <h3>Ontvangen abonnementsbetalingen</h3>
        <p>{fullMonth.format(monthDate(reports.month))} · Stripe live · incl. btw</p>
        <p>Bruto, vóór terugbetalingen en Stripe-kosten.</p>
      </div>
      <strong className="admin-revenue-value">{reports.revenueCents !== null ? euros.format(reports.revenueCents / 100)
        : billingMode === "test" ? "Alleen beschikbaar met Stripe live" : unavailable}</strong>
    </section>
  </>;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!await canUsePlatformAdmin(user.uid)) notFound();

  const query = parseAdminQuery(await searchParams);
  if (!query) notFound();
  const data = await readAdminData(query);
  const { overview, reports } = data;
  const listView = query.view === "customers" || query.view === "subscriptions" ? query.view : null;
  const billing = listView === "subscriptions";
  const listing = listView === "customers" ? data.customers : data.subscriptions;
  const metrics = overview ? [
    { title: "Registraties", value: overview.registered, detail: "Time2Pay-accounts", icon: Users },
    { title: "Actieve accounts", value: overview.active, detail: "Geverifieerd en ingeschakeld", icon: CircleCheck },
    { title: "Proefperiodes", value: overview.trials, detail: "Nu lopend", icon: Clock3 },
    { title: "Abonnementen", value: overview.subscriptions, detail: "Actief in Stripe", icon: CreditCard },
    { title: "Openstaande tickets", value: overview.tickets, detail: "Alle niet-afgehandelde tickets", icon: Headphones, href: "/support" },
  ] : [];

  return <div className="admin-shell">
    <header className="admin-header">
      <a href="/dashboard" aria-label="Naar het Time2Pay-dashboard"><BrandLogo size="mini" /></a>
      <span className="admin-header-title">Beheercentrum</span>
      <span className="admin-header-role"><LockKeyhole size={16} aria-hidden /> Beheerder</span>
    </header>
    <div className="admin-layout">
      <nav className="admin-nav" aria-label="Beheercentrum">
        <p className="admin-eyebrow">Time2Pay beheer</p>
        {navigation.map(({ id, label, short, href, icon: Icon }) =>
          <a key={id} href={href} aria-current={id === query.view ? "page" : undefined} aria-label={label}>
            <Icon size={18} aria-hidden /><span className="admin-nav-wide">{label}</span><span className="admin-nav-short">{short}</span>
          </a>)}
        <div className="admin-nav-note"><ShieldCheck size={17} aria-hidden />
          <strong>Alleen voor beheer</strong><p>Klanten, abonnementen en betalingen zijn alleen-lezen.</p>
        </div>
      </nav>
      <div className="admin-content">
        <div className="admin-title">
          <p className="admin-eyebrow">Time2Pay · Platformbeheer</p>
          <h1>Beheercentrum</h1>
          <p>Volg Time2Pay-accounts, abonnementen en support op één plek.</p>
        </div>
        <p className="admin-checked"><CalendarDays size={15} aria-hidden /> Opgevraagd op <time dateTime={data.checkedAt}>{datetime.format(new Date(data.checkedAt))}</time></p>
        {data.billingMode === "test" ? <p className="admin-banner">Stripe is aangesloten in testmodus. Abonnementsstatussen zijn testgegevens.</p> : null}
        {data.billingMode === null ? <p className="admin-banner">Stripe · {unavailable}</p> : null}
        {overview ? <>
          <h2>Overzicht</h2>
          <div className="admin-metrics">{metrics.map(({ title, value, detail, icon: Icon, href }) => {
            const content = <><div className="admin-icon"><Icon size={18} aria-hidden /></div>
              <h3>{title}</h3><strong>{value === null ? "—" : number.format(value)}</strong>
              <small>{value === null ? unavailable : detail}</small></>;
            return href ? <a className="admin-card admin-metric" key={title} href={href}>{content}</a>
              : <div className="admin-card admin-metric" key={title}>{content}</div>;
          })}</div>
        </> : null}
        {reports ? <section className="admin-section">
          <div className="admin-section-heading"><h2>Rapportages</h2>
            {query.view === "reports" ? <form className="admin-period" action="/admin" method="get">
              <input type="hidden" name="view" value="reports" />
              <label htmlFor="admin-month">Betaalmaand</label>
              <input className="input" id="admin-month" type="month" name="month" min="2000-01"
                max={monthKey(new Date(data.checkedAt))} defaultValue={query.month} required />
              <button className="btn-secondary">Tonen</button>
            </form> : <a href="/admin?view=reports">Bekijk rapportages →</a>}
          </div>
          <Reports reports={reports} billingMode={data.billingMode} />
        </section> : null}
        {overview ? <section className="admin-section">
          <div className="admin-section-heading"><div><h2>Recente registraties</h2><p>Time2Pay-gebruikers · Firebase</p></div>
            <a href="/admin?view=customers">Alle gebruikers →</a>
          </div>
          {overview.recent ? <AccountTable rows={overview.recent} /> : <p className="admin-empty">{unavailable}</p>}
        </section> : null}
        {listView ? <section className="admin-section">
          <div className="admin-section-heading"><div><h2>{billing ? "Abonnementen" : "Klantenbeheer"}</h2>
            <p>{billing ? "Gekoppelde Stripe-abonnementen en Time2Pay-proefperiodes. Betaalstatus en achterstand betreffen de laatste factuur."
              : "Geregistreerde Time2Pay-gebruikers uit Firebase."}</p></div></div>
          {listing ? <><AccountTable rows={listing.rows} billing={billing} /><Pagination view={listView} data={listing} /></>
            : <p className="admin-empty">{unavailable}</p>}
        </section> : null}
        <footer className="admin-footer">Time2Pay Beheercentrum · alleen-lezen</footer>
      </div>
    </div>
  </div>;
}
