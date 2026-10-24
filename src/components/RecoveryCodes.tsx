"use client";
import { useState } from "react";
export default function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const safeCodes = codes.filter(code => /^[A-F0-9]{4}(?:-[A-F0-9]{4}){7}$/.test(code));
  function download() {
    const text = "Time2Pay herstelcodes\nBewaar dit bestand buiten je telefoon. Iedere code werkt één keer.\n\n" + safeCodes.join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "time2pay-herstelcodes.txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function print() {
    const page = window.open("", "_blank", "width=850,height=700");
    if (!page) return;
    page.opener = null;
    page.document.write("<!doctype html><html lang='nl'><head><meta charset='utf-8'><title>Time2Pay herstelcodes</title></head><body><h1>Time2Pay herstelcodes</h1><p>Bewaar veilig buiten je telefoon. Iedere code werkt één keer.</p><pre>" + safeCodes.join("\n") + "</pre></body></html>");
    page.document.close(); page.focus(); page.print();
  }
  return <section className="space-y-5 rounded-lg border border-[#eadfda] bg-white p-6">
    <h1 className="text-2xl font-semibold">Bewaar je herstelcodes</h1>
    <p>Deze tien codes worden alleen nu getoond. Bewaar ze privé, op een andere plek dan je telefoon. Deel ze nooit met support.</p>
    <ol className="space-y-2 font-mono text-sm">{safeCodes.map(code => <li key={code}>{code}</li>)}</ol>
    <div className="flex flex-wrap gap-3">
      <button type="button" className="rounded border px-4 py-2" onClick={download}>Codes downloaden</button>
      <button type="button" className="rounded border px-4 py-2" onClick={print}>Codes afdrukken</button>
    </div>
    <label className="flex items-start gap-2"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />Ik heb de codes veilig bewaard.</label>
    <button type="button" disabled={!saved || safeCodes.length !== 10} onClick={onDone}
      className="rounded bg-[#543749] px-4 py-3 text-white disabled:opacity-50">Verder</button>
  </section>;
}
