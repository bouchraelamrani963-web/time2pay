import { normalizeShiftRates, SHIFT_LABELS, SHIFT_TYPES } from "@/lib/shift-rates";

export default function ShiftRateFields({ rates, ortAgreed = false }: { rates?: unknown; ortAgreed?: boolean }) {
  const values = normalizeShiftRates(rates);
  return <fieldset className="space-y-4 border-t border-[#eee5e1] pt-5">
    <legend className="text-base font-semibold text-[#33243b]">Uurtarieven voor deze klant</legend>
    <p className="text-sm text-[#726671]">Vaste bedragen per uur, exclusief btw. Leeg betekent nog niet ingesteld; 0 is een gratis tarief. Nieuwe facturen nemen deze tarieven over. Bestaande facturen blijven gelijk.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {SHIFT_TYPES.map(type => <label key={type} className="label">{SHIFT_LABELS[type]} (€ / uur)
        <input name={`rate_${type}`} aria-label={`${SHIFT_LABELS[type]} uurtarief`} className="input mt-1" type="number" inputMode="decimal" min="0" max="100000" step="0.01" defaultValue={values[type] ?? ""} placeholder="Niet ingesteld" />
      </label>)}
    </div>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="ortAgreed" defaultChecked={ortAgreed} className="mt-1" />
      <span>ORT-percentages zijn met deze klant afgesproken (optioneel). Op een factuur kies ik apart of ik ORT gebruik op het basisuurtarief van de dagdienst.</span>
    </label>
  </fieldset>;
}
