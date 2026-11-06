"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Building2, FileText, LockKeyhole, Users } from "lucide-react";
import { BUSINESS_SEATS, roleLabel, type BusinessAction } from "@/lib/business/contracts";
import { ClientEditor, DraftEditor, Field, SettingsEditor } from "./BusinessForms";
import type { Dashboard, Overview, Seat, Submit } from "./types";

const empty: Overview = { companies: [], invitations: [], canCreate: false };
const money = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const date = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "medium" });
type Tab = "Facturen" | "Klanten" | "Rapportages" | "Teambeheer" | "Bedrijfsinstellingen";

async function api<T>(company?: string, action?: BusinessAction, signal?: AbortSignal, page = 1) {
  const response = await fetch(company ? `/api/business/${encodeURIComponent(company)}?page=${page}` : "/api/business", {
    cache: "no-store", signal,
    ...(action ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "De aanvraag is mislukt.");
  return data as T;
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="card space-y-4 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-[#543749]">{title}</h2>{action}</div>
    {children}
  </section>;
}

export default function BusinessWorkspace() {
  const [overview, setOverview] = useState(empty);
  const [company, setCompany] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>("Facturen");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editingClient, setEditingClient] = useState<string>();
  const [editingInvoice, setEditingInvoice] = useState<string>();
  const submitting = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    api<Overview>(undefined, undefined, controller.signal).then(data => {
      setOverview(data);
      setCompany(data.companies[0]?.id ?? "");
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!company) return;
    const controller = new AbortController();
    api<Dashboard>(company, undefined, controller.signal, page).then(setDashboard)
      .catch(reason => { if (!controller.signal.aborted) { setDashboard(undefined); setError(reason.message); } });
    return () => controller.abort();
  }, [company, page]);

  async function submit(input: BusinessAction, target = company) {
    if (submitting.current) return false;
    submitting.current = true;
    setBusy(true); setNotice(""); setError("");
    try {
      const result = await api<{ id?: string; emailSent?: boolean }>(input.action === "createCompany" ? undefined : target, input);
      if (input.action === "createCompany" || input.action === "accept" || input.action === "settings") {
        const data = await api<Overview>();
        setOverview(data);
      }
      const nextCompany = input.action === "createCompany" || input.action === "accept" ? result.id ?? target : target;
      if (nextCompany === company) {
        try { setDashboard(await api<Dashboard>(nextCompany, undefined, undefined, page)); }
        catch (reason) { setDashboard(undefined); throw reason; }
      } else {
        setDashboard(undefined);
        setCompany(nextCompany);
        setPage(1);
        setTab("Facturen");
      }
      setNotice(result.emailSent === false
        ? "De uitnodiging staat klaar in Time2Pay. De e-mail kon niet worden verstuurd."
        : result.emailSent ? "De uitnodiging is per e-mail verstuurd." : "Opgeslagen.");
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "De aanvraag is mislukt.");
      return false;
    } finally { submitting.current = false; setBusy(false); }
  }

  const send: Submit = input => submit(input);
  const data = dashboard?.id === company ? dashboard : undefined;
  const owner = data?.role === "OWNER";
  const employee = data?.role === "EMPLOYEE";
  const tabs: Tab[] = ["Facturen", "Klanten", ...(!employee ? ["Rapportages" as const] : []),
    ...(owner ? ["Teambeheer" as const, "Bedrijfsinstellingen" as const] : [])];

  return <div className="space-y-5">
    <header className="rounded-xl border border-[#e9deda] bg-[#f8f0eb] p-5 sm:p-7">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#865741]"><Building2 size={18} aria-hidden /> Time2Pay Business</div>
      <h1 className="break-words text-3xl font-semibold text-[#543749]">{data?.name ?? "Bedrijfsadministratie"}</h1>
      <p className="mt-2 text-[#62545d]">{data ? `Gedeelde bedrijfsadministratie · ${roleLabel[data.role]}` : "Open je Business-omgeving of accepteer een uitnodiging."}</p>
      {overview.companies.length > 1 && <div className="mt-4 max-w-sm"><Field label="Bedrijfsomgeving">
        <select className="input" value={company} disabled={busy} onChange={event => {
          setError(""); setNotice(""); setDashboard(undefined); setCompany(event.target.value); setPage(1); setTab("Facturen");
          setEditingClient(undefined); setEditingInvoice(undefined);
        }}>{overview.companies.map(item => <option key={item.id} value={item.id}>{item.name} · {roleLabel[item.role]}</option>)}</select>
      </Field></div>}
    </header>
    {notice && <p className="rounded-md bg-[#edf5ef] p-3 text-sm text-[#285a42]" role="status">{notice}</p>}
    {error && <p className="rounded-md bg-[#fbefed] p-3 text-sm text-[#8a342b]" role="alert">{error}</p>}
    {loading && <p role="status">Business-omgeving laden…</p>}
    {overview.invitations.length > 0 && <Panel title="Uitnodigingen">
      {overview.invitations.map(invite => <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3">
        <p>{invite.company.name} · {roleLabel[invite.role]} · geldig t/m {date.format(new Date(invite.expiresAt))}</p>
        <button className="btn-primary" disabled={busy} onClick={() => void submit({ action: "accept", seatId: invite.id }, invite.company.id)}>Uitnodiging accepteren</button>
      </div>)}
    </Panel>}
    {overview.canCreate && <Panel title="Bedrijfsomgeving aanmaken">
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault();
        void submit({ action: "createCompany", name: String(new FormData(event.currentTarget).get("name")) });
      }}>
        <Field label="Bedrijfsnaam"><input name="name" className="input" required maxLength={150} /></Field>
        <button className="btn-primary" disabled={busy}>Bedrijf aanmaken</button>
      </form>
    </Panel>}
    {!loading && !error && !company && !overview.canCreate && !overview.invitations.length &&
      <Panel title="Nog geen Business-omgeving"><p>Een actief Business-abonnement of een uitnodiging is nodig om hier aan de slag te gaan.</p></Panel>}
    {company && !data && !error && <p role="status">Bedrijfsgegevens laden…</p>}
    {data && <>
      {!data.active && <p className="rounded-md border border-[#e4c5ad] bg-[#fff5e9] p-4 text-sm" role="status">
        <LockKeyhole size={16} className="mr-2 inline" aria-hidden /> Business is gepauzeerd. Als eigenaar kun je gegevens raadplegen, definitieve facturen downloaden en teamtoegang intrekken.
      </p>}
      <nav className="flex flex-wrap gap-2" aria-label="Business-navigatie">
        {tabs.map(item => <button type="button" key={item} className={item === tab ? "btn-primary" : "btn-secondary"} aria-pressed={item === tab}
          onClick={() => { setTab(item); setEditingClient(undefined); setEditingInvoice(undefined); }}>{item}</button>)}
      </nav>
      {tab === "Klanten" && <Panel title={employee ? "Klanten voor je concepten" : "Gedeelde klanten"} action={!employee && data.active &&
        <button className="btn-primary" onClick={() => setEditingClient("new")}>Nieuwe klant</button>}>
        {editingClient && <ClientEditor key={editingClient} current={data.clients.find(item => item.id === editingClient)}
          busy={busy} submit={send} close={() => setEditingClient(undefined)} />}
        {data.clients.length === 0 && <p>Er zijn nog geen klanten in deze bedrijfsomgeving.</p>}
        <ul className="divide-y divide-[#e9deda]">{data.clients.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 break-words"><p className="font-medium">{item.name}</p>{!employee && <p className="text-sm text-[#62545d]">{item.email || item.address}</p>}</div>
          {!employee && data.active && <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => setEditingClient(item.id)}>Bewerken</button>
            {owner && <button className="btn-secondary" disabled={busy} onClick={() => {
              if (window.confirm(`Klant ${item.name} verwijderen?`)) void send({ action: "deleteClient", clientId: item.id });
            }}>Verwijderen</button>}
          </div>}
        </li>)}</ul>
      </Panel>}
      {tab === "Facturen" && <Panel title={employee ? "Mijn conceptfacturen" : "Gedeelde facturen"} action={data.active &&
        <button className="btn-primary" disabled={!data.clients.length} onClick={() => setEditingInvoice("new")}><FileText size={16} aria-hidden /> Nieuw concept</button>}>
        {editingInvoice && <DraftEditor key={editingInvoice} current={data.invoices.find(item => item.id === editingInvoice)}
          clients={data.clients} busy={busy} submit={send} close={() => setEditingInvoice(undefined)} />}
        {!data.invoices.length && <p>{data.clients.length ? "Er zijn nog geen facturen in dit overzicht." : "Voeg eerst een bedrijfsklant toe om een concept te maken."}</p>}
        <ul className="divide-y divide-[#e9deda]">{data.invoices.map(item => {
          const clientName = data.clients.find(client => client.id === item.clientId)?.name;
          const pdf = `/api/business/${encodeURIComponent(data.id)}/pdf/${encodeURIComponent(item.id)}`;
          const state = item.status === "DRAFT" ? "Concept" : item.status === "PAID" ? "Betaald"
            : item.status === "CANCELLED" ? "Geannuleerd" : item.businessSentAt ? "Verstuurd" : "Definitief";
          return <li key={item.id} className="space-y-3 py-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div className="min-w-0 break-words"><p className="font-semibold">{item.finalizedAt ? item.number : "Conceptfactuur"} · {clientName}</p>
                <p className="text-sm text-[#62545d]">{state} · Vervalt {date.format(new Date(item.dueDate))}</p></div>
              <p className="font-semibold">{money.format(item.total)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.status === "DRAFT" && data.active && <>
                <button className="btn-secondary" onClick={() => setEditingInvoice(item.id)}>Concept bewerken</button>
                {owner && <button className="btn-secondary" disabled={busy} onClick={() => {
                  if (window.confirm("Dit concept verwijderen?")) void send({ action: "deleteDraft", invoiceId: item.id });
                }}>Verwijderen</button>}
                {!employee && <button className="btn-primary" disabled={busy} onClick={() => {
                  if (window.confirm("Factuur definitief maken? De gegevens en het nummer worden vastgelegd.")) void send({ action: "finalize", invoiceId: item.id });
                }}>Definitief maken</button>}
              </>}
              {item.finalizedAt && <a className="btn-secondary" href={pdf}>PDF downloaden</a>}
              {item.finalizedAt && data.active && item.status !== "CANCELLED" && <>
                {!item.businessSentAt && <button className="btn-secondary" disabled={busy} onClick={() => {
                  if (window.confirm("Verstuur deze definitieve factuur per e-mail?")) void send({ action: "send", invoiceId: item.id });
                }}>Versturen</button>}
                {item.businessSentAt && item.status !== "PAID" && item.dueDate.slice(0, 10) < new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date()) &&
                  <button className="btn-secondary" disabled={busy} onClick={() => {
                    if (window.confirm("Stuur een betalingsherinnering per e-mail?")) void send({ action: "remind", invoiceId: item.id });
                  }}>Herinnering sturen</button>}
                <button className="btn-secondary" disabled={busy} onClick={() => {
                  if (item.status !== "PAID" || window.confirm("Betaling terugdraaien in de administratie?")) {
                    void send({ action: "payment", invoiceId: item.id, paid: item.status !== "PAID" });
                  }
                }}>{item.status === "PAID" ? "Betaling terugdraaien" : "Betaling registreren"}</button>
                {owner && item.status !== "PAID" && <button className="btn-secondary" disabled={busy} onClick={() => {
                  if (window.confirm("Factuur administratief annuleren? Het document en nummer blijven bewaard.")) void send({ action: "cancel", invoiceId: item.id });
                }}>Annuleren</button>}
              </>}
            </div>
          </li>;
        })}</ul>
        {data.pages > 1 && <nav className="flex flex-wrap items-center gap-3" aria-label="Factuurpagina's">
          <button className="btn-secondary" disabled={busy || data.page <= 1} onClick={() => setPage(data.page - 1)}>Vorige</button>
          <span>Pagina {data.page} van {data.pages}</span>
          <button className="btn-secondary" disabled={busy || data.page >= data.pages} onClick={() => setPage(data.page + 1)}>Volgende</button>
        </nav>}
      </Panel>}
      {tab === "Rapportages" && data.report && <Panel title="Omzetrapportage">
        <p className="text-sm text-[#62545d]">Vanaf {date.format(new Date(data.createdAt))}. Alleen definitieve, niet-geannuleerde facturen.</p>
        <dl className="grid gap-3 sm:grid-cols-3">{[
          ["Gefactureerd excl. btw", data.report.reduce((sum, row) => sum + (row._sum.subtotal ?? 0), 0)],
          ["Ontvangen incl. btw", data.report.find(row => row.status === "PAID")?._sum.total ?? 0],
          ["Openstaand incl. btw", data.report.filter(row => row.status !== "PAID").reduce((sum, row) => sum + (row._sum.total ?? 0), 0)],
        ].map(([label, value]) => <div key={label} className="rounded-md bg-[#fbf8f5] p-4"><dt>{label}</dt>
          <dd className="mt-1 text-xl font-semibold">{money.format(Number(value))}</dd></div>)}</dl>
      </Panel>}
      {tab === "Teambeheer" && owner && <TeamPanel data={data} busy={busy} submit={send} />}
      {tab === "Bedrijfsinstellingen" && owner && <Panel title="Bedrijfsinstellingen"><SettingsEditor key={data.id} data={data} submit={send} busy={busy} /></Panel>}
    </>}
  </div>;
}

function TeamPanel({ data, busy, submit }: { data: Dashboard; busy: boolean; submit: Submit }) {
  const seats = data.seats ?? [];
  return <Panel title="Teambeheer" action={<span className="inline-flex items-center gap-2 rounded-md bg-[#f8f0eb] px-3 py-2 text-sm font-medium">
    <Users size={16} aria-hidden /> {seats.length + 1} van {BUSINESS_SEATS} plaatsen gebruikt</span>}>
    <p className="text-sm text-[#62545d]">Een open uitnodiging reserveert zeven dagen een plaats. Elk teamlid gebruikt een eigen aanmelding met TOTP.</p>
    <a className="btn-secondary" href="/billing">Mijn abonnement beheren</a>
    {data.active && seats.length + 1 < BUSINESS_SEATS && <form className="flex flex-wrap items-end gap-3 rounded-md bg-[#fbf8f5] p-4" onSubmit={async event => {
      event.preventDefault();
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      if (await submit({ action: "invite", email: String(form.get("email")), role: form.get("role") as Seat["role"] })) formElement.reset();
    }}>
      <Field label="E-mailadres teamlid"><input className="input" name="email" type="email" maxLength={254} required /></Field>
      <Field label="Rol"><select className="input" name="role"><option value="EMPLOYEE">Medewerker</option><option value="ADMINISTRATION">Administratie</option></select></Field>
      <button className="btn-primary" disabled={busy}>Uitnodigen</button>
    </form>}
    <ul className="divide-y divide-[#e9deda]">
      <li className="py-3"><p className="break-all font-semibold">{data.ownerEmail}</p><p className="text-sm text-[#62545d]">Eigenaar · Actief</p></li>
      {seats.map(seat => <li key={seat.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><p className="break-all font-semibold">{seat.email}</p>
          <p className="text-sm text-[#62545d]">{seat.expiresAt ? `Uitgenodigd · verloopt ${date.format(new Date(seat.expiresAt))}` : "Actief"}</p></div>
        <div className="flex flex-wrap items-end gap-2">
          {data.active ? <Field label="Rol"><select className="input" aria-label={`Rol van ${seat.email}`} disabled={busy} value={seat.role}
            onChange={event => void submit({ action: "changeRole", seatId: seat.id, role: event.target.value as Seat["role"] })}>
            <option value="EMPLOYEE">Medewerker</option><option value="ADMINISTRATION">Administratie</option>
          </select></Field> : <p>{roleLabel[seat.role]}</p>}
          {data.active && seat.expiresAt && <button className="btn-secondary" disabled={busy} onClick={() =>
            void submit({ action: "resendInvite", seatId: seat.id })}>Opnieuw mailen</button>}
          <button className="btn-secondary" disabled={busy} onClick={() => {
            if (window.confirm(`${seat.expiresAt ? "Uitnodiging" : "Toegang"} van ${seat.email} intrekken?`)) void submit({ action: "removeSeat", seatId: seat.id });
          }}>{seat.expiresAt ? "Uitnodiging intrekken" : "Toegang intrekken"}</button>
        </div>
      </li>)}
    </ul>
  </Panel>;
}
