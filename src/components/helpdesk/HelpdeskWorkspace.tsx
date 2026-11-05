"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronRight, Clock3, Headphones, LayoutDashboard, MessageSquare, Plus, Search, Send, ShieldCheck, Ticket, X } from "lucide-react";
import { categories, priorities, statuses, type TicketDetail, type TicketList, type TicketPriority, type TicketStatus } from "@/lib/helpdesk/contracts";
import { articles } from "@/lib/helpdesk/knowledge";
import "./helpdesk.css";
type Props = { initial: TicketList; staff?: boolean; canManage?: boolean; knowledge?: boolean };
const date = (value: string) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }).format(new Date(value));
const warning = "Deel geen wachtwoorden, authenticatorcodes of herstelcodes. Support vraagt hier nooit om.";
export default function HelpdeskWorkspace({ initial, staff = false, canManage = false, knowledge = false }: Props) {
  const [list, setList] = useState(initial), [tab, setTab] = useState(knowledge ? "knowledge" : "tickets");
  const [detail, setDetail] = useState<TicketDetail | null>(null), [newTicket, setNewTicket] = useState(false);
  const [q, setQ] = useState(""), [search, setSearch] = useState(""), [status, setStatus] = useState(""), [priority, setPriority] = useState("");
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [reply, setReply] = useState(""), [editStatus, setEditStatus] = useState<TicketStatus>("OPEN"), [editPriority, setEditPriority] = useState<TicketPriority>("NORMAL");
  const [replySending, setReplySending] = useState(false), [replyNotice, setReplyNotice] = useState(""), [replyError, setReplyError] = useState("");
  const replyInFlight = useRef(false);
  const [article, setArticle] = useState<string | null>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null), sequence = useRef(0);
  const base = "/api/helpdesk/tickets";
  const view = staff ? "view=support&" : "";
  async function request<T>(url: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { method, cache: "no-store", signal, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.error || "De aanvraag is niet gelukt. Probeer het opnieuw.");
    return data as T;
  }
  async function reload(page = 1) {
    const params = new URLSearchParams({ page: String(page), q: search, status, priority });
    setList(await request<TicketList>(`${base}?${view}${params}`));
  }
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: "1", q: search, status, priority });
    request<TicketList>(`${base}?${view}${params}`, "GET", undefined, controller.signal)
      .then(data => { if (active) setList(data); })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  // Filters are the request inputs; the API base and role are fixed for this mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, priority, staff]);
  function showDetail(data: TicketDetail) {
    setReplyNotice(""); setReplyError("");
    setDetail(data); setEditStatus(data.status); setEditPriority(data.priority); setNewTicket(false); setReply("");
    requestAnimationFrame(() => detailHeading.current?.focus());
  }
  async function openTicket(id: string) {
    const current = ++sequence.current; setBusy(true); setError(""); setNotice("");
    try { const data = await request<TicketDetail>(`${base}/${id}?${view}`); if (current === sequence.current) showDetail(data); }
    catch (e) { setError((e as Error).message); } finally { if (current === sequence.current) setBusy(false); }
  }
  async function submitTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      const ticket = await request<{ id: string; number: string }>(base, "POST", { subject: form.get("subject"), category: form.get("category"), body: form.get("body") });
      setNotice(`Je aanvraag ${ticket.number} is ontvangen.`); showDetail(await request<TicketDetail>(`${base}/${ticket.id}`));
      await reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function sendReply(event: React.FormEvent) {
    event.preventDefault(); if (!detail || busy || replyInFlight.current || !reply.trim()) return;
    replyInFlight.current = true; setReplySending(true); setBusy(true);
    setReplyError(""); setReplyNotice(""); setError(""); setNotice("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const saved = await request<TicketDetail>(`${base}/${detail.id}/messages?${view}`, "POST", { body: reply }, controller.signal);
      if (saved.id !== detail.id || !Array.isArray(saved.messages) || !saved.messages.some(m => m.body === reply.trim() && m.fromSupport === staff)) {
        throw Error("De server gaf geen geldige opslagbevestiging. Vernieuw de aanvraag voordat je opnieuw verzendt.");
      }
      setDetail(saved); setEditStatus(saved.status); setEditPriority(saved.priority);
      setReply("");
      setReplyNotice(staff ? "Je antwoord is succesvol verzonden." : "Je reactie is succesvol verzonden.");
      // Refresh the list separately: a slow/failing list must not keep a saved answer busy.
      void reload(list.page).catch(() => {});
    } catch (e) {
      setReplyError(controller.signal.aborted
        ? "Geen verzendbevestiging ontvangen. Je tekst is bewaard. Vernieuw de aanvraag om te controleren of je antwoord is opgeslagen voordat je opnieuw verzendt."
        : `Verzenden niet bevestigd: ${(e as Error).message} Je tekst is bewaard.`);
    } finally {
      clearTimeout(timeout); replyInFlight.current = false; setReplySending(false); setBusy(false);
    }
  }
  async function saveSettings() {
    if (!detail) return; setBusy(true); setError("");
    try { const data = await request<TicketDetail>(`${base}/${detail.id}`, "PATCH", { status: editStatus, priority: editPriority });
      setDetail(data); setNotice("Status en prioriteit zijn bijgewerkt."); await reload(list.page); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function older() {
    if (!detail?.messages.length) return; setBusy(true); setError("");
    try { const previous = await request<TicketDetail>(`${base}/${detail.id}?${view}before=${detail.messages[0].id}`);
      setDetail({ ...detail, hasOlderMessages: previous.hasOlderMessages, messages: [...previous.messages, ...detail.messages] }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const total = Object.values(list.counts).reduce((a, b) => a + b, 0);
  const open = total - list.counts.RESOLVED;
  function switchTab(next: string) { if (replyInFlight.current) return; setTab(next); setDetail(null); setNewTicket(false); setError(""); setNotice(""); }
  const faq = <section className="hd-card hd-faq"><div className="hd-section-title"><BookOpen size={19} /><h2>Veelgestelde vragen</h2></div>
    {articles.filter(a => ["factureren", "abonnement", "tweestapsverificatie"].includes(a.id)).map(a => <button key={a.id} type="button" onClick={() => { switchTab("knowledge"); setArticle(a.id); }}>{a.title}<ChevronRight size={17} /></button>)}
    <button type="button" className="hd-all-articles" onClick={() => switchTab("knowledge")}>Alle helpartikelen bekijken <ArrowRight size={16} /></button></section>;
  return <div className="hd-workspace">
    <aside className="hd-sidebar" aria-label="Helpdesknavigatie">
      <div className="hd-sidebar-title"><Headphones size={25} /><span>Time2Pay<br /><strong>{staff ? "Supportbeheer" : "Helpdesk"}</strong></span></div>
      <a href="/dashboard"><LayoutDashboard size={18} /> Dashboard</a>
      <button type="button" className={tab === "tickets" ? "active" : ""} onClick={() => switchTab("tickets")} aria-current={tab === "tickets" ? "page" : undefined}><Ticket size={18} />{staff ? "Alle tickets" : "Mijn aanvragen"}</button>
      <button type="button" className={tab === "knowledge" ? "active" : ""} onClick={() => switchTab("knowledge")} aria-current={tab === "knowledge" ? "page" : undefined}><BookOpen size={18} /> Kennisbank</button>
      {(canManage || staff) && <a href={staff ? "/helpdesk" : "/support"}><ShieldCheck size={18} />{staff ? "Klantenportaal" : "Supportbeheer"}</a>}
      <div className="hd-sidebar-note"><ShieldCheck size={20} /><p>Je gegevens blijven privé.<br />Alleen jij en Time2Pay Support kunnen je aanvragen lezen.</p></div>
    </aside>
    <div className="hd-main">
      <header className="hd-header"><div><p className="hd-eyebrow">{staff ? "TIME2PAY SUPPORT" : "WE HELPEN JE GRAAG"}</p><h1>{staff ? "Helpdesk – Beheer" : "Mijn support"}</h1><p>{staff ? "Alle klantvragen op één overzichtelijke plek." : "Stel je vraag of bekijk de voortgang van je aanvragen."}</p></div><span className="hd-header-icon"><Headphones size={29} /></span></header>
      {error && <div role="alert" className="hd-alert">{error}</div>}
      {notice && <div role="status" className="hd-notice"><CheckCircle2 size={18} />{notice}</div>}
      {tab === "knowledge" ? <section aria-label="Kennisbank"><div className="hd-content-heading"><div><h2>Kennisbank</h2><p>Een helder antwoord, zodat jij weer verder kunt.</p></div></div><div className="hd-articles">{articles.map(a => <details key={a.id} open={article === a.id} onToggle={e => { if (e.currentTarget.open) setArticle(a.id); }}><summary><span><small>{a.category}</small>{a.title}</span><ChevronRight size={18} /></summary><p>{a.body}</p></details>)}</div><p className="hd-footnote">Kom je er niet uit? Maak een supportaanvraag. Deel daarbij geen inloggegevens.</p>{!staff && <button className="btn-primary" type="button" onClick={() => { switchTab("tickets"); setNewTicket(true); }}><Plus size={17} /> Nieuwe supportaanvraag</button>}</section> : <>
        {staff && <div className="hd-stats">{[{ label: "Totaal tickets", value: total, icon: Ticket }, { label: "Openstaand", value: open, icon: Clock3 }, { label: "Wacht op klant", value: list.counts.WAITING_CUSTOMER, icon: MessageSquare }, { label: "Afgehandeld", value: list.counts.RESOLVED, icon: CheckCircle2 }].map(s => <div key={s.label}><s.icon size={22} /><span><strong>{s.value}</strong>{s.label}</span></div>)}</div>}
        {newTicket ? <section className="hd-card hd-form"><div className="hd-content-heading"><h2>Nieuwe supportaanvraag</h2><button className="hd-icon-button" type="button" onClick={() => setNewTicket(false)} aria-label="Aanvraag annuleren" disabled={busy}><X size={21} /></button></div><p className="hd-privacy"><ShieldCheck size={17} />{warning}</p><form onSubmit={submitTicket}>
          <label className="label" htmlFor="hd-subject">Onderwerp</label><input id="hd-subject" name="subject" className="input" required minLength={3} maxLength={160} placeholder="Waar kunnen we je mee helpen?" />
          <label className="label" htmlFor="hd-category">Categorie</label><select id="hd-category" name="category" className="input" required defaultValue=""><option value="" disabled>Kies een categorie</option>{Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <label className="label" htmlFor="hd-body">Omschrijving</label><textarea id="hd-body" name="body" className="input" rows={6} required minLength={10} maxLength={8000} placeholder="Beschrijf je vraag en wat je al hebt geprobeerd." aria-describedby="hd-body-hint" /><p id="hd-body-hint" className="hd-footnote">Maximaal 8.000 tekens. {warning}</p>
          <div className="hd-actions"><button type="button" className="btn-secondary" onClick={() => setNewTicket(false)} disabled={busy}>Annuleren</button><button className="btn-primary" disabled={busy}><Send size={16} />{busy ? "Versturen…" : "Aanvraag versturen"}</button></div></form></section> : detail ? <section className="hd-card hd-detail">
          <button type="button" className="hd-back" disabled={busy} onClick={() => { ++sequence.current; setDetail(null); setNotice(""); }}><ArrowLeft size={16} />Alle aanvragen</button><div className="hd-ticket-title"><div><p className="hd-eyebrow">{detail.number} · {categories[detail.category]}</p><h2 ref={detailHeading} tabIndex={-1}>{detail.subject}</h2><p className="hd-footnote">{staff ? `${detail.customerName} · ${detail.customerEmail}` : `Aangemaakt ${date(detail.createdAt)}`}</p></div><span className={`hd-badge hd-status-${detail.status}`}>{statuses[detail.status]}</span></div>
          {staff && <div className="hd-settings"><label>Status<select className="input" value={editStatus} onChange={e => setEditStatus(e.target.value as TicketStatus)} disabled={busy}>{Object.entries(statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><label>Prioriteit<select className="input" value={editPriority} onChange={e => setEditPriority(e.target.value as TicketPriority)} disabled={busy}>{Object.entries(priorities).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><button type="button" className="btn-secondary" disabled={busy} onClick={saveSettings}>Opslaan</button></div>}
          <div className="hd-messages" aria-label="Gesprek">{detail.hasOlderMessages && <button type="button" className="hd-back" disabled={busy} onClick={older}>Oudere berichten laden</button>}{detail.messages.map(m => <article key={m.id} className={m.fromSupport ? "hd-message support" : "hd-message"}><div><strong>{m.fromSupport ? "Time2Pay Support" : staff ? detail.customerName : "Jij"}</strong><time dateTime={m.createdAt}>{date(m.createdAt)}</time></div><p>{m.body}</p></article>)}</div>
          <form className="hd-reply" onSubmit={sendReply} aria-busy={replySending}><label className="label" htmlFor="hd-reply">{staff ? "Antwoord aan klant" : "Je reactie"}</label><textarea id="hd-reply" className="input" disabled={replySending} value={reply} onChange={e => setReply(e.target.value)} rows={4} maxLength={8000} required aria-describedby="hd-reply-hint" placeholder="Schrijf je reactie…" /><p id="hd-reply-hint" className="hd-footnote">{warning}{!staff && detail.status === "RESOLVED" ? " Met je reactie wordt deze aanvraag heropend." : ""}</p>{replyNotice && <div role="status" aria-live="polite" className="hd-notice"><CheckCircle2 size={18} />{replyNotice}</div>}{replyError && <div role="alert" className="hd-alert">{replyError}</div>}<div className="hd-actions"><button className="btn-primary" disabled={busy || replySending || !reply.trim()}><Send size={16} />{replySending ? "Bezig met verzenden..." : staff ? "Antwoord versturen" : "Reactie versturen"}</button></div></form></section> : <>
          {!staff && <div className="hd-welcome"><span><MessageSquare size={30} /></span><div><h2>Hulp nodig?</h2><p>Stel eenvoudig je vraag of meld een probleem.</p></div><button className="btn-primary" type="button" disabled={busy} onClick={() => { setNewTicket(true); setNotice(""); }}><Plus size={18} />Nieuwe supportaanvraag</button></div>}
          <div className={staff ? "" : "hd-customer-columns"}><section className="hd-ticket-section"><div className="hd-content-heading"><h2>{staff ? "Alle tickets" : "Mijn aanvragen"}</h2><span className="hd-count">{list.total}</span></div>
            <form className="hd-filters" onSubmit={e => { e.preventDefault(); setSearch(q); }}><div className="hd-search"><Search size={17} /><input aria-label="Zoeken op ticketnummer, klant of onderwerp" placeholder={staff ? "Ticket, klant of onderwerp…" : "Zoek een aanvraag…"} value={q} maxLength={160} onChange={e => setQ(e.target.value)} /><button type="submit" aria-label="Zoeken"><ArrowRight size={17} /></button></div><select className="input" aria-label="Filter op status" value={status} onChange={e => setStatus(e.target.value)}><option value="">Alle statussen</option>{Object.entries(statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>{staff && <select className="input" aria-label="Filter op prioriteit" value={priority} onChange={e => setPriority(e.target.value)}><option value="">Alle prioriteiten</option>{Object.entries(priorities).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</form>
            <div className="hd-card hd-ticket-list" aria-busy={loading}><div className={`hd-table-head ${staff ? "staff" : ""}`}><span>Aanvraag / onderwerp</span>{staff && <span>Klant</span>}<span>Status</span><span>Laatst bijgewerkt</span><span /></div>
              {loading ? <p className="hd-empty" role="status">Aanvragen laden…</p> : list.tickets.length === 0 ? <div className="hd-empty"><Ticket size={30} /><h3>{search || status || priority ? "Geen aanvragen gevonden" : "Je hebt nog geen aanvragen"}</h3><p>{search || status || priority ? "Pas je zoekopdracht of filters aan." : "Een vraag over Time2Pay? We helpen je graag."}</p></div> : list.tickets.map(t => <button type="button" key={t.id} className={`hd-ticket-row ${staff ? "staff" : ""}`} onClick={() => openTicket(t.id)} disabled={busy} aria-label={`${t.number}: ${t.subject}`}><span className="hd-row-subject"><small>{t.number} · {categories[t.category]}</small><strong>{t.subject}</strong>{staff && <em className={`hd-priority hd-priority-${t.priority}`}>{priorities[t.priority]}</em>}</span>{staff && <span className="hd-customer-name">{t.customerName}</span>}<span><span className={`hd-badge hd-status-${t.status}`}>{statuses[t.status]}</span></span><time dateTime={t.updatedAt}>{date(t.updatedAt)}</time><ChevronRight className="hd-row-chevron" size={17} /></button>)}
            </div><div className="hd-pagination"><span>{list.total} {list.total === 1 ? "aanvraag" : "aanvragen"} · pagina {list.page}</span><div><button type="button" className="hd-icon-button" disabled={loading || list.page <= 1} onClick={async () => { setLoading(true); try { await reload(list.page - 1); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }} aria-label="Vorige pagina"><ArrowLeft size={17} /></button><button type="button" className="hd-icon-button" disabled={loading || list.page * 20 >= list.total} onClick={async () => { setLoading(true); try { await reload(list.page + 1); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }} aria-label="Volgende pagina"><ArrowRight size={17} /></button></div></div>
          </section>{!staff && faq}</div></>}
      </>}
      <footer className="hd-footer"><span>Time2Pay Helpdesk</span><span>Je werk gedaan. Je factuur geregeld.</span></footer>
    </div>
  </div>;
}
