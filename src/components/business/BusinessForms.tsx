"use client";

import { useState, type ReactNode } from "react";
import { SHIFT_LABELS, SHIFT_TYPES } from "@/lib/shift-rates";
import type { Client, Dashboard, DraftItem, Invoice, Submit } from "./types";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-sm font-medium text-[#543749]">{label}{children}</label>;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const newItem = (): DraftItem => ({ type: "HOURS", description: "", quantity: 1, unitPrice: 0, ortPerc: 0, sortOrder: 0 });

export function ClientEditor({ current, busy, submit, close }: {
  current?: Client; busy: boolean; submit: Submit; close: () => void;
}) {
  return <form className="grid gap-3 rounded-md bg-[#fbf8f5] p-4" onSubmit={async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (await submit({ action: "client", clientId: current?.id, client: {
      name: text(form, "name"), email: text(form, "email"), phone: text(form, "phone"),
      address: text(form, "address"), vatNumber: text(form, "vatNumber"), ortAgreed: form.has("ortAgreed"),
      shiftRates: Object.fromEntries(SHIFT_TYPES.map(type => [type, text(form, type) ? Number(text(form, type)) : null])),
    } })) close();
  }}>
    <div className="grid gap-3 sm:grid-cols-2">
      {([["name", "Klantnaam"], ["email", "E-mailadres"], ["phone", "Telefoon"], ["address", "Adres"], ["vatNumber", "Btw-id"]] as const)
        .map(([key, label]) => <Field key={key} label={label}><input className="input" name={key}
          type={key === "email" ? "email" : "text"} maxLength={key === "name" ? 150 : key === "email" ? 254 : 500}
          required={key === "name"} defaultValue={current?.[key] ?? ""} /></Field>)}
    </div>
    <details><summary className="cursor-pointer font-medium">Uurtarieven en ORT</summary>
      <div className="my-3 grid gap-3 sm:grid-cols-3">{SHIFT_TYPES.map(type =>
        <Field key={type} label={SHIFT_LABELS[type]}><input className="input" name={type} type="number" min={0} max={100000} step="0.01"
          defaultValue={current?.shiftRates?.[type] ?? ""} /></Field>)}</div>
      <label className="flex gap-2 text-sm"><input name="ortAgreed" type="checkbox" defaultChecked={current?.ortAgreed} /> ORT afgesproken met deze klant</label>
    </details>
    <div className="flex flex-wrap gap-2"><button className="btn-primary" disabled={busy}>Klant opslaan</button>
      <button className="btn-secondary" type="button" onClick={close}>Sluiten</button></div>
  </form>;
}

export function DraftEditor({ current, clients, busy, submit, close }: {
  current?: Invoice; clients: Client[]; busy: boolean; submit: Submit; close: () => void;
}) {
  const [clientId, setClientId] = useState(current?.clientId ?? clients[0]?.id ?? "");
  const [items, setItems] = useState<DraftItem[]>(() => current?.items.map(item => ({
    type: item.type, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice,
    unit: item.unit ?? undefined, serviceType: item.serviceType, ortPerc: item.ortPerc, sortOrder: item.sortOrder,
  })) ?? [newItem()]);
  const client = clients.find(item => item.id === clientId);
  const [ortAgreed, setOrtAgreed] = useState(current?.ortAgreed ?? false);
  function update(index: number, item: Partial<DraftItem>) {
    setItems(previous => previous.map((old, i) => i === index ? { ...old, ...item } : old));
  }

  return <form className="grid gap-3 rounded-md bg-[#fbf8f5] p-4" onSubmit={async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (await submit({ action: "draft", invoiceId: current?.id, invoice: {
      clientId, dueDate: text(form, "dueDate"), vatRate: Number(text(form, "vatRate")),
      ortAgreed: Boolean(client?.ortAgreed && ortAgreed),
      items: items.map((item, sortOrder) => ({ ...item, sortOrder, ortPerc: ortAgreed && client?.ortAgreed ? item.ortPerc ?? 0 : 0 })),
    } })) close();
  }}>
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Klant"><select className="input" value={clientId} onChange={event => { setClientId(event.target.value); setOrtAgreed(false); }} required>
        {clients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <Field label="Vervaldatum"><input className="input" name="dueDate" type="date" required defaultValue={current?.dueDate.slice(0, 10)
        ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)} /></Field>
      <Field label="Btw (%)"><input className="input" name="vatRate" type="number" min={0} max={100} step="0.01" required defaultValue={current?.vatRate ?? 21} /></Field>
    </div>
    {client?.ortAgreed && <label className="flex gap-2 text-sm"><input type="checkbox" checked={ortAgreed} onChange={e => setOrtAgreed(e.target.checked)} /> ORT toepassen</label>}
    {items.map((item, index) => <fieldset key={index} className="grid gap-3 rounded-md border border-[#e9deda] bg-white p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Factuurregel {index + 1}</legend>
      <Field label="Omschrijving"><input className="input" value={item.description} maxLength={2000} required onChange={e => update(index, { description: e.target.value })} /></Field>
      <Field label="Type"><select className="input" value={item.type} onChange={e => update(index, { type: e.target.value as DraftItem["type"], serviceType: null, ortPerc: 0 })}>
        <option value="HOURS">Uren</option><option value="FIXED">Vast bedrag</option><option value="M2">Per m²</option><option value="MATERIAL">Materiaal</option>
      </select></Field>
      {item.type === "HOURS" && <Field label="Dienst"><select className="input" value={item.serviceType ?? "DAY"} onChange={e => {
        const serviceType = e.target.value as NonNullable<DraftItem["serviceType"]>;
        update(index, { serviceType, unitPrice: client?.shiftRates?.[ortAgreed ? "DAY" : serviceType] ?? item.unitPrice });
      }}>{SHIFT_TYPES.map(type => <option key={type} value={type}>{SHIFT_LABELS[type]}</option>)}</select></Field>}
      {item.type === "HOURS" && ortAgreed && client?.ortAgreed && <Field label="ORT (%)"><select className="input" value={item.ortPerc ?? 0}
        onChange={e => update(index, { ortPerc: Number(e.target.value) as DraftItem["ortPerc"] })}>{[0, 25, 50, 100].map(value => <option key={value}>{value}</option>)}</select></Field>}
      {item.type !== "FIXED" && <Field label="Aantal"><input className="input" type="number" min={0} max={100000} step="0.0001" required
        value={item.quantity} onChange={e => update(index, { quantity: e.target.valueAsNumber || 0 })} /></Field>}
      <Field label="Prijs (€)"><input className="input" type="number" min={0} max={100000} step="0.01" required
        value={item.unitPrice} onChange={e => update(index, { unitPrice: e.target.valueAsNumber || 0 })} /></Field>
      {items.length > 1 && <button className="btn-secondary justify-self-start" type="button"
        onClick={() => setItems(previous => previous.filter((_, i) => i !== index))}>Regel verwijderen</button>}
    </fieldset>)}
    <div className="flex flex-wrap gap-2">
      <button className="btn-secondary" type="button" disabled={items.length >= 100} onClick={() => setItems(previous => [...previous, newItem()])}>Regel toevoegen</button>
      <button className="btn-primary" disabled={busy}>Concept opslaan</button>
      <button className="btn-secondary" type="button" onClick={close}>Sluiten</button>
    </div>
  </form>;
}

const settingsFields = {
  companyName: "Bedrijfsnaam", contactName: "Contactpersoon", street: "Straat en huisnummer", postalCode: "Postcode",
  city: "Plaats", kvkNumber: "KvK-nummer", vatId: "Btw-id", iban: "Zakelijk IBAN",
  email: "Zakelijk e-mailadres", phone: "Telefoon",
} as const;

export function SettingsEditor({ data, submit, busy }: { data: Dashboard; submit: Submit; busy: boolean }) {
  return <form className="grid gap-4" onSubmit={async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!window.confirm("Bedrijfs- en factuurinstellingen opslaan? Deze gegevens gelden voor toekomstige definitieve facturen.")) return;
    const fields = Object.fromEntries(Object.keys(settingsFields).map(key => [key, text(form, key)]));
    const settings = { ...fields, pdfStyle: form.get("pdfStyle") } as NonNullable<Dashboard["settings"]>;
    await submit({ action: "settings", settings, invoicePrefix: text(form, "invoicePrefix"), invoiceTemplate: text(form, "invoiceTemplate") });
  }}>
    <p className="text-sm text-[#62545d]">Wijzigingen gelden voor toekomstige definitieve facturen. Hiervoor is een recente aanmelding met TOTP nodig. <a className="underline" href="/login?next=/business">Opnieuw aanmelden</a></p>
    <div className="grid gap-3 sm:grid-cols-2">
      {(Object.keys(settingsFields) as (keyof typeof settingsFields)[]).map(key =>
        <Field label={settingsFields[key]} key={key}><input className="input" name={key} type={key === "email" ? "email" : "text"}
          defaultValue={data.settings?.[key] ?? (key === "companyName" ? data.name : "")} required={key !== "phone"}
          disabled={!data.active} autoComplete={key === "iban" ? "off" : undefined} /></Field>)}
      <Field label="Factuurnummervoorvoegsel"><input className="input" name="invoicePrefix" pattern="[a-zA-Z0-9]{1,12}" maxLength={12}
        defaultValue={data.invoicePrefix ?? "F"} required disabled={!data.active} /></Field>
    </div>
    <Field label="Factuursjabloon"><select className="input" name="pdfStyle" defaultValue={data.settings?.pdfStyle ?? "CLASSIC"} disabled={!data.active}>
      <option value="CLASSIC">Time2Pay klassiek</option><option value="NEUTRAL">Zakelijk neutraal</option>
    </select></Field>
    <Field label="Standaardtekst op de factuur"><textarea className="input" name="invoiceTemplate" maxLength={500}
      defaultValue={data.invoiceTemplate ?? ""} disabled={!data.active} /></Field>
    <button className="btn-primary justify-self-start" disabled={busy || !data.active}>Bedrijfsinstellingen opslaan</button>
  </form>;
}
